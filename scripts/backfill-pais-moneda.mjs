#!/usr/bin/env node
/**
 * Backfill one-shot e idempotente: a cada empresa sin `pais`/`moneda` le añade `pais: 'ES'` y `moneda: 'EUR'`.
 * El código ya tolera que falten (`paisDeEmpresa` / `monedaDeEmpresa`), pero conviene dejar los datos completos
 * antes de que las rules los marquen como inmutables para los miembros.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/backfill-pais-moneda.mjs [--dry-run]
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { parchePaisMoneda } from './backfill-pais-moneda.lib.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 400;

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

let updated = 0;
let last = null;
for (;;) {
  let q = db.collection('companies').orderBy(FieldPath.documentId()).limit(BATCH_SIZE);
  if (last) q = q.startAfter(last);
  const snap = await q.get();
  if (snap.empty) break;
  last = snap.docs[snap.docs.length - 1];

  const batch = db.batch();
  let inBatch = 0;
  for (const docSnap of snap.docs) {
    const patch = parchePaisMoneda(docSnap.data());
    if (Object.keys(patch).length === 0) continue;
    if (!DRY_RUN) batch.update(docSnap.ref, patch);
    inBatch++;
  }
  if (inBatch > 0 && !DRY_RUN) await batch.commit();
  updated += inBatch;
  if (snap.size < BATCH_SIZE) break;
}

console.log(`companies: ${updated} empresas ${DRY_RUN ? 'necesitan backfill (dry-run)' : 'actualizadas'}`);
