import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { periodoAvanzado } from './avanzar';

const LOTE = 400;
const MAX_LOTES = 50;

/**
 * Cada hora avanza `derechos.periodoUso` de las empresas cuyo mes (en SU zona horaria) ya terminó.
 * Las rules no pueden hacer aritmética de zonas, así que leen esta copia; mientras el scheduler no
 * llega, tratan `request.time >= periodoUso.fin` como mes nuevo (cupo a cero), así que el retraso
 * (<= 1 h) nunca bloquea a nadie. Consulta por un único campo (`derechos.periodoUso.fin`): usa el
 * índice automático, no hace falta índice compuesto. Cada empresa se atiende una vez al mes.
 */
export const avanzarPeriodosUso = onSchedule(
  { schedule: 'every 60 minutes', timeZone: 'Europe/Madrid', retryCount: 0, timeoutSeconds: 300 },
  async () => {
    const db = admin.firestore();
    const ahora = new Date();
    let avanzadas = 0;
    for (let lote = 0; lote < MAX_LOTES; lote++) {
      const snap = await db
        .collection('companies')
        .where('derechos.periodoUso.fin', '<=', Timestamp.fromDate(ahora))
        .limit(LOTE)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      let n = 0;
      for (const d of snap.docs) {
        const nuevo = periodoAvanzado(d.data(), ahora);
        if (!nuevo) continue;
        batch.update(d.ref, { 'derechos.periodoUso': nuevo });
        n++;
      }
      if (n === 0) break; // evita bucle si algo no avanza
      await batch.commit();
      avanzadas += n;
      if (snap.size < LOTE) break;
    }
    logger.info('avanzarPeriodosUso', { avanzadas });
  },
);
