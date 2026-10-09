import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { debeExpirar, expirar, type EmpresaConSuscripcion, type SuscripcionDoc } from './suscripcion';

/** Tope por ejecución (batch de Firestore = 500); lo que sobre se atiende al día siguiente. */
const MAX_POR_EJECUCION = 400;

/**
 * Cada día cierra las pruebas vencidas: estado 'prueba' + periodoFin <= ahora pasa a
 * 'activa' con el plan declarado (free en autoservicio). Los derechos ya bajan solos en
 * el cliente al pasar periodoFin (derechosEfectivos); esto persiste el cambio.
 * Las demos NO se tocan aquí: su fin (periodoFin = alta + 14 d) se deriva en las rules y en el cliente
 * a partir de `derechos.hasta/despues` y `suscripcion.periodoFin`, sin cron ni borrado de datos.
 * Requiere el índice compuesto companies(suscripcion.estado, suscripcion.periodoFin).
 */
export const expirarPruebas = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'Europe/Madrid', retryCount: 0 },
  async () => {
    const db = admin.firestore();
    const ahora = new Date();
    const snap = await db
      .collection('companies')
      .where('suscripcion.estado', '==', 'prueba')
      .where('suscripcion.periodoFin', '<=', Timestamp.fromDate(ahora))
      .limit(MAX_POR_EJECUCION)
      .get();

    const batch = db.batch();
    let n = 0;
    for (const d of snap.docs) {
      const data = d.data() as EmpresaConSuscripcion & { suscripcion: SuscripcionDoc };
      if (!debeExpirar(data, ahora)) continue;
      batch.update(d.ref, { ...expirar(data.suscripcion), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      n++;
    }
    if (n > 0) await batch.commit();
    logger.info('expirarPruebas', { candidatas: snap.size, expiradas: n });
  },
);
