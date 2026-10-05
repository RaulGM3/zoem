import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { assertCompanyAccess } from '../lib/assertCompanyAccess';
import { manejarValidarQr } from './validarQr';
import type { QrValidacionServidor, ValidarQrDeps } from './validarQr';
import { crearConsulta } from './validarQrFetch';

// Adaptador de Firestore (Admin SDK) sin tests unitarios (como adapters.ts): la lógica vive en validarQr.ts.
const facturaRef = (companyId: string, facturaId: string) =>
  admin.firestore().doc(`companies/${companyId}/facturas_recibidas/${facturaId}`);

const deps: ValidarQrDeps = {
  async leerFactura(companyId, facturaId) {
    const snap = await facturaRef(companyId, facturaId).get();
    if (!snap.exists) return null;
    const url: unknown = snap.get('qr.url');
    return { qrUrl: typeof url === 'string' && url !== '' ? url : null };
  },
  consultar: crearConsulta(),
  async guardar(companyId, facturaId, validacion) {
    // `qrValidacion` es de solo servidor para el cliente (rules); el Admin SDK lo reemplaza entero.
    await facturaRef(companyId, facturaId).update({
      qrValidacion: { ...validacion, at: admin.firestore.FieldValue.serverTimestamp() },
    });
  },
};

/**
 * Callable: entrada `{companyId, facturaId}`; salida `{estado, urlConsulta, mensaje?}`. Solo Admin/Gestor de la
 * empresa. Consulta ValidarQR de la AEAT con la URL reconstruida desde el `qr.url` guardado y persiste el resultado
 * en `qrValidacion`. Idempotente: reintentar es volver a llamar. Timeout 30 s (consulta 10 s + escritura).
 */
export const validarQrFacturaRecibida = onCall<unknown, Promise<QrValidacionServidor>>(
  { enforceAppCheck: false, timeoutSeconds: 30, invoker: 'public' },
  (request) => manejarValidarQr(deps, assertCompanyAccess, request.auth?.uid, request.data),
);
