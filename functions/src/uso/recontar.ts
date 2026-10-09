import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { esEmpresaDemo } from '../autoservicio/suscripcion';
import { CAMPO_DE, deltaUso, type CampoUso, type TipoUso } from './uso';

type Datos = Record<string, unknown>;

/** Total de un tipo sobre un conjunto de docs: reutiliza `deltaUso` (antes = nada, después = doc). */
export function totalDe(tipo: TipoUso, docs: readonly { id: string; data: Datos }[], esDemo: boolean): number {
  return docs.reduce((acc, d) => acc + deltaUso(tipo, d.id, undefined, d.data, esDemo), 0);
}

/**
 * Recalcula `companies/{cid}/uso/total` leyendo los datos reales. Sirve para (a) empresas que pasan
 * a tener `derechos` con datos previos y (b) corregir derivas del contador (los triggers son
 * at-least-once: un reintento podría contar dos veces). Los contadores mensuales no se tocan.
 */
export async function recontarUso(cid: string): Promise<Partial<Record<CampoUso, number>>> {
  const db = admin.firestore();
  const empresa = await db.doc(`companies/${cid}`).get();
  const esDemo = esEmpresaDemo(empresa.data());
  const leer = async (col: string) =>
    (await db.collection(col).get()).docs.map((d) => ({ id: d.id, data: d.data() as Datos }));

  const [casos, contactos, plantillas, miembros, filesContacto] = await Promise.all([
    leer(`companies/${cid}/casos`),
    leer(`companies/${cid}/contactos`),
    leer(`companies/${cid}/casoPlantillas`),
    leer(`companies/${cid}/members`),
    db.collection('contact_files').where('companyId', '==', cid).get()
      .then((s) => s.docs.map((d) => ({ id: d.id, data: d.data() as Datos }))),
  ]);
  const archivosCaso = (await Promise.all(casos.map((c) => leer(`companies/${cid}/casos/${c.id}/doc_files`)))).flat();

  const total: Partial<Record<CampoUso, number>> = {
    casosActivos: totalDe('caso', casos, esDemo),
    contactos: totalDe('contacto', contactos, esDemo),
    plantillas: totalDe('plantilla', plantillas, esDemo),
    usuarios: totalDe('miembro', miembros, esDemo),
    documentosBytes: totalDe('archivo', [...archivosCaso, ...filesContacto], esDemo),
  };
  await db.doc(`companies/${cid}/uso/total`).set(total, { merge: true });
  logger.info('Uso recalculado', { cid, total, campos: Object.values(CAMPO_DE).length });
  return total;
}

/** Solo superusuario: recalcula los contadores de una empresa. */
export const recalcularUso = onCall<{ companyId?: string }, Promise<Partial<Record<CampoUso, number>>>>(
  { enforceAppCheck: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    const user = await admin.firestore().doc(`users/${uid}`).get();
    if (user.get('isSuperUser') !== true) throw new HttpsError('permission-denied', 'Solo el superusuario');
    const cid = request.data?.companyId;
    if (typeof cid !== 'string' || !cid) throw new HttpsError('invalid-argument', 'Falta companyId');
    return recontarUso(cid);
  },
);
