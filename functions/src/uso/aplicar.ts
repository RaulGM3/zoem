import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { esEmpresaDemo } from '../autoservicio/suscripcion';
import { CAMPO_DE, claveMes, deltaUso, sumarUso, type TipoUso, type UsoDb } from './uso';

const dbReal: UsoDb = {
  async sumar(path, campo, delta) {
    await admin.firestore().doc(path).set({ [campo]: FieldValue.increment(delta) }, { merge: true });
  },
};

type Datos = Record<string, unknown> | undefined;

/** Solo hace falta saber si es demo cuando el id parece del seed (`demo-…`): evita una lectura por evento. */
async function esDemoSiHaceFalta(cid: string, id: string, tipo: TipoUso): Promise<boolean> {
  if (tipo === 'miembro' || !id.startsWith('demo-')) return false;
  const snap = await admin.firestore().doc(`companies/${cid}`).get();
  return esEmpresaDemo(snap.data());
}

/**
 * Aplica el efecto de un write sobre el contador que le toca. Nunca lanza: un fallo de
 * contabilidad no debe romper otros efectos del mismo trigger (p. ej. las notificaciones).
 */
export async function contarUso(
  tipo: TipoUso,
  cid: string,
  id: string,
  antes: Datos,
  despues: Datos,
  cuando: Date = new Date(),
): Promise<void> {
  try {
    const delta = deltaUso(tipo, id, antes, despues, await esDemoSiHaceFalta(cid, id, tipo));
    const doc = tipo === 'accion' ? claveMes(cuando) : 'total';
    await sumarUso(dbReal, cid, doc, CAMPO_DE[tipo], delta);
  } catch (e) {
    logger.error('contarUso falló', { tipo, cid, id, error: (e as Error).message });
  }
}
