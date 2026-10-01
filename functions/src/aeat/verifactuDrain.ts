import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { crearDeps } from './adapters';
import { drenarEmpresa } from './submit';

/** Máximo de empresas por tick; el resto se atiende en el siguiente (cada minuto). */
const MAX_EMPRESAS_POR_TICK = 25;

/**
 * Cada minuto drena las colas Verifactu con trabajo vencido (`drainAt <= ahora`): reenvía
 * pendings atascados y envía la cabeza de cada cola respetando el control de flujo de AEAT.
 * Consulta collection-group `verifactuChain.drainAt` (ver fieldOverrides en firestore.indexes.json).
 */
export const verifactuDrain = onSchedule(
  { schedule: 'every 1 minutes', timeoutSeconds: 300, retryCount: 0 },
  async () => {
    const ahora = new Date().toISOString();
    const snap = await admin
      .firestore()
      .collectionGroup('verifactuChain')
      .where('drainAt', '<=', ahora)
      .limit(MAX_EMPRESAS_POR_TICK)
      .get();

    const deps = crearDeps();
    const companyIds = snap.docs.map((d) => d.ref.parent.parent?.id).filter((id): id is string => !!id);
    const resultados = await Promise.allSettled(companyIds.map((id) => drenarEmpresa(deps, id)));
    resultados.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error('[VerifactuDrain] fallo drenando', companyIds[i], r.reason instanceof Error ? r.reason.message : 'error desconocido');
      }
    });
  },
);
