import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

const DB = '(default)';

/**
 * Sincroniza companyId, role y estado como custom claims cada vez que un
 * miembro se crea, actualiza o elimina. Las Storage rules leen el token
 * en vez de hacer firestore.get() (que solo soporta la base (default)).
 *
 * El claim isSuperUser lo gestiona syncSuperuserClaim por separado; este
 * trigger lo preserva al hacer merge con los claims existentes.
 */
export const syncMemberClaims = onDocumentWritten(
  { document: 'companies/{cid}/members/{uid}', database: DB },
  async (event) => {
    const uid = event.params['uid'];
    const cid = event.params['cid'];

    const existing = await getExistingClaims(uid);

    if (!event.data?.after?.exists) {
      await admin.auth().setCustomUserClaims(uid, {
        ...existing,
        companyId: null,
        role: null,
        estado: null,
      });
      logger.info('Member deleted — claims cleared', { uid, cid });
      return;
    }

    const data = event.data.after.data()!;
    await admin.auth().setCustomUserClaims(uid, {
      ...existing,
      companyId: cid,
      role: data['role'] ?? null,
      estado: data['estado'] ?? null,
    });
    logger.info('Member claims synced', { uid, cid, role: data['role'] });
  }
);

/**
 * Sincroniza el claim isSuperUser cuando cambia el doc users/{uid}.
 * Preserva los claims de membresía al hacer merge.
 */
export const syncSuperuserClaim = onDocumentWritten(
  { document: 'users/{uid}', database: DB },
  async (event) => {
    const uid = event.params['uid'];
    if (!event.data?.after?.exists) return;

    const data = event.data.after.data()!;
    const existing = await getExistingClaims(uid);
    await admin.auth().setCustomUserClaims(uid, {
      ...existing,
      isSuperUser: data['isSuperUser'] === true,
    });
    logger.info('Superuser claim synced', { uid, isSuperUser: data['isSuperUser'] });
  }
);

/**
 * HTTP endpoint de un solo uso para backfill inicial: recorre todos los
 * miembros existentes y les escribe los custom claims.
 *
 * Requiere autenticación GCP (invoker: private). Llamar una sola vez
 * tras el primer deploy y luego se puede dejar — es idempotente.
 *
 * Desde la CLI: gcloud functions call backfillMemberClaims --region=europe-west1
 * O desde la consola de Cloud Functions haciendo clic en "Test function".
 */
export const backfillMemberClaims = onRequest(
  { invoker: 'private' },
  async (_req, res) => {
    const db = getFirestore(admin.app(), DB);
    const companiesSnap = await db.collection('companies').get();

    let synced = 0;
    let failed = 0;

    for (const companyDoc of companiesSnap.docs) {
      const cid = companyDoc.id;
      const membersSnap = await db
        .collection('companies')
        .doc(cid)
        .collection('members')
        .get();

      for (const memberDoc of membersSnap.docs) {
        const uid = memberDoc.id;
        const data = memberDoc.data();
        try {
          const existing = await getExistingClaims(uid);
          await admin.auth().setCustomUserClaims(uid, {
            ...existing,
            companyId: cid,
            role: data['role'] ?? null,
            estado: data['estado'] ?? null,
          });
          synced++;
        } catch (err) {
          logger.error('Failed to set claims', { uid, cid, err });
          failed++;
        }
      }
    }

    logger.info('Backfill complete', { synced, failed });
    res.json({ ok: true, synced, failed });
  }
);

async function getExistingClaims(uid: string): Promise<Record<string, unknown>> {
  try {
    const user = await admin.auth().getUser(uid);
    return (user.customClaims as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}
