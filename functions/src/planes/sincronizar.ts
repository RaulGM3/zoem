import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { recontarUso } from '../uso/recontar';
import type { Suscripcion } from './catalogo';
import { derechosParaDoc, igualesDerechos, type DerechosDoc } from './derechosDoc';

/**
 * Mantiene `companies/{cid}.derechos` (copia denormalizada de los derechos efectivos, que leen las
 * security rules) cada vez que cambia la empresa. Es idempotente: si no hay cambios no escribe,
 * así que su propia escritura no provoca un bucle.
 *
 * - Sin `suscripcion` (empresa legada) se BORRA `derechos` => las rules no restringen nada.
 * - Cuando `derechos` aparece por primera vez en una empresa con datos, se recalculan los
 *   contadores de uso (si no, el cupo empezaría en 0 aunque ya tenga 40 casos).
 */
export const sincronizarDerechos = onDocumentWritten(
  { document: 'companies/{cid}', database: '(default)' },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const data = after.data() as { suscripcion?: Suscripcion; derechos?: DerechosDoc };

    const nuevo = derechosParaDoc(data.suscripcion, new Date());
    if (igualesDerechos(data.derechos, nuevo)) return;

    await after.ref.update({ derechos: nuevo ?? FieldValue.delete() });
    logger.info('Derechos sincronizados', { cid: event.params['cid'], plan: data.suscripcion?.plan ?? null });

    if (nuevo && !data.derechos) {
      const total = await admin.firestore().doc(`companies/${event.params['cid']}/uso/total`).get();
      if (!total.exists) await recontarUso(event.params['cid']);
    }
  },
);
