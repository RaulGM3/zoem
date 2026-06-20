// ============================================================================
// Migración: membresía + invitaciones al nuevo modelo de seguridad.
//
// QUÉ HACE:
//   1) companyMembers/{randomId}  →  companies/{companyId}/members/{userId}
//      (doc id determinista = userId; lo que exigen las security rules)
//   2) companyInvitations pendientes  →  re-keyea el doc id == token
//      (las rules leen la invitación por get() usando el token como id)
//
// CÓMO CORRERLO (desde la carpeta functions/, que tiene firebase-admin):
//   cd functions
//   GOOGLE_APPLICATION_CREDENTIALS=/ruta/serviceAccount.json \
//     DRY_RUN=1 node ../scripts/migrate-members.mjs      # simulación
//   GOOGLE_APPLICATION_CREDENTIALS=/ruta/serviceAccount.json \
//     node ../scripts/migrate-members.mjs                # ejecuta
//
// Es idempotente: re-correrlo no duplica nada. NO borra el companyMembers viejo
// (verificá primero que el login funciona, después limpiás a mano).
// ============================================================================

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');

const DRY_RUN = process.env.DRY_RUN === '1';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.GCLOUD_PROJECT || 'vertey-cf1b9',
});
const db = admin.firestore();

async function migrateMembers() {
  const snap = await db.collection('companyMembers').get();
  console.log(`\n[members] ${snap.size} docs en companyMembers`);
  let ok = 0, skip = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const { companyId, userId } = data;
    if (!companyId || !userId) {
      console.warn(`  ⚠️  skip ${d.id}: falta companyId/userId`);
      skip++;
      continue;
    }
    const target = db.doc(`companies/${companyId}/members/${userId}`);
    console.log(`  ${DRY_RUN ? '[dry]' : '✓'} companyMembers/${d.id} → companies/${companyId}/members/${userId} (${data.role})`);
    if (!DRY_RUN) {
      // merge: no pisa un ultimoLogin/edición más reciente si ya migró
      await target.set(data, { merge: true });
    }
    ok++;
  }
  console.log(`[members] migrados=${ok} omitidos=${skip}`);
}

async function rekeyInvitations() {
  const snap = await db.collection('companyInvitations').where('status', '==', 'pending').get();
  console.log(`\n[invitations] ${snap.size} invitaciones pendientes`);
  let ok = 0, skip = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const token = data.token;
    if (!token) { console.warn(`  ⚠️  skip ${d.id}: sin token`); skip++; continue; }
    if (d.id === token) { skip++; continue; } // ya tiene id == token
    console.log(`  ${DRY_RUN ? '[dry]' : '✓'} companyInvitations/${d.id} → companyInvitations/${token}`);
    if (!DRY_RUN) {
      await db.doc(`companyInvitations/${token}`).set(data, { merge: true });
      await d.ref.delete(); // borra el doc con id random (ya re-keyeado)
    }
    ok++;
  }
  console.log(`[invitations] re-keyeadas=${ok} omitidas=${skip}`);
}

(async () => {
  console.log(DRY_RUN ? '🟡 DRY RUN (no escribe nada)' : '🟢 EJECUTANDO');
  await migrateMembers();
  await rekeyInvitations();
  console.log('\nListo.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
