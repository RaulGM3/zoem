import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { assertCompanyAccess } from '../lib/assertCompanyAccess';
import { vigentesEn, type DerechosDoc } from '../planes/derechosDoc';
import { claveMes } from '../uso/uso';
import { decidirReserva, validarReserva } from './reserva';

export interface RespuestaReserva {
  usado: number;
  /** `null` = ilimitado. */
  limite: number | null;
}

/**
 * RESERVA de cupo de IA. El cliente la llama ANTES de cada petición a Gemini (Firebase AI Logic sigue
 * yendo directo desde el navegador: el agente usa function calling y firmas de pensamiento del SDK
 * que no merece la pena reimplementar en un proxy).
 *
 * Qué garantiza: el contador mensual `uso/{yyyy-mm}.iaMensajesMes` solo sube si cabe en el límite
 * (transacción) y se rechaza con `resource-exhausted` al agotarlo.
 * Qué NO garantiza: quien llame a Gemini sin pasar por aquí (cliente modificado, o con el token
 * App Check del navegador) no queda bloqueado. Es un cupo "de honor reforzado" por App Check, no una
 * barrera dura; para eso haría falta el proxy (fase 4).
 */
export const reservarIA = onCall<unknown, Promise<RespuestaReserva>>(
  { enforceAppCheck: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    const v = validarReserva(request.data);
    if (!v.ok) throw new HttpsError('invalid-argument', 'Datos no válidos');
    const { companyId, n } = v.valor;
    await assertCompanyAccess(uid, companyId, ['Admin', 'Gestor', 'Usuario', 'Viewer']);

    const db = admin.firestore();
    const ahora = new Date();
    const empresaRef = db.doc(`companies/${companyId}`);
    const usoRef = db.doc(`companies/${companyId}/uso/${claveMes(ahora)}`);

    return db.runTransaction(async (tx) => {
      const [empresa, uso] = await Promise.all([tx.get(empresaRef), tx.get(usoRef)]);
      if (!empresa.exists) throw new HttpsError('not-found', 'La empresa no existe');
      // Sin `derechos` (empresa legada) no se restringe.
      const d = vigentesEn(empresa.get('derechos') as DerechosDoc | undefined, ahora);
      if (d && (d.soloLectura || d.funciones.ia === false)) {
        throw new HttpsError('failed-precondition', 'Tu plan no incluye la IA');
      }
      const limite = d ? d.limites.iaMensajesMes : null;
      const usado = Number(uso.get('iaMensajesMes') ?? 0);
      const r = decidirReserva({ usado, limite, n });
      if (!r.ok) {
        throw new HttpsError('resource-exhausted', 'Has agotado el cupo mensual de IA', { usado: r.usado, limite: r.limite });
      }
      tx.set(usoRef, { iaMensajesMes: r.usado }, { merge: true });
      return { usado: r.usado, limite };
    });
  },
);
