#!/usr/bin/env node
/**
 * Backfill one-shot e idempotente para los documentos legacy, OBLIGATORIO
 * antes de desplegar las rules de clasificados (Fase 3):
 *
 * - `doc_files`, `doc_slots` (subcolecciones de casos) y `contact_files`:
 *   siembra `clasificado: false` y `deleted: false` donde falten. Sin esto,
 *   los docs legacy no salen de la query `where('clasificado','==',false)`
 *   de los no-admins (los filtros de igualdad excluyen campos ausentes).
 * - `plantilla_files` y `companies/{cid}/docTemplates`: siembra
 *   `visibleTo: 'all'` y `deleted: false` donde falten.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/backfill-doc-flags.mjs [--dry-run]
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 400;

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

let totalUpdated = 0;

async function backfillQuery(label, queryFn, patchFor) {
  let last = null;
  let updated = 0;
  for (;;) {
    let q = queryFn().orderBy(FieldPath.documentId()).limit(BATCH_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    last = snap.docs[snap.docs.length - 1];

    const batch = db.batch();
    let inBatch = 0;
    for (const docSnap of snap.docs) {
      const patch = patchFor(docSnap.data());
      if (Object.keys(patch).length === 0) continue;
      if (!DRY_RUN) batch.update(docSnap.ref, patch);
      inBatch++;
    }
    if (inBatch > 0 && !DRY_RUN) await batch.commit();
    updated += inBatch;
    if (snap.size < BATCH_SIZE) break;
  }
  console.log(`${label}: ${updated} docs ${DRY_RUN ? 'necesitan backfill (dry-run)' : 'actualizados'}`);
  totalUpdated += updated;
}

const classifiedPatch = (data) => ({
  ...(data.clasificado === undefined ? { clasificado: false } : {}),
  ...(data.deleted === undefined ? { deleted: false } : {}),
});

const visibilityPatch = (data) => ({
  ...(data.visibleTo === undefined ? { visibleTo: 'all' } : {}),
  ...(data.deleted === undefined ? { deleted: false } : {}),
});

// Subcolecciones de casos → collection group.
await backfillQuery('doc_files (casos)', () => db.collectionGroup('doc_files'), classifiedPatch);
await backfillQuery('doc_slots (casos)', () => db.collectionGroup('doc_slots'), classifiedPatch);
await backfillQuery('contact_files', () => db.collection('contact_files'), classifiedPatch);
await backfillQuery('plantilla_files', () => db.collection('plantilla_files'), visibilityPatch);
await backfillQuery('docTemplates', () => db.collectionGroup('docTemplates'), visibilityPatch);
await backfillQuery('contact_folders', () => db.collection('contact_folders'), (d) =>
  d.deleted === undefined ? { deleted: false } : {});
await backfillQuery('plantilla_folders', () => db.collection('plantilla_folders'), (d) =>
  d.deleted === undefined ? { deleted: false } : {});

console.log(`\nTotal: ${totalUpdated} documentos ${DRY_RUN ? 'pendientes' : 'backfilleados'}.`);
