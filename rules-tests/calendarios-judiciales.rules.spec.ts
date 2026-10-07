/**
 * Reglas de companies/{cid}/calendariosJudiciales/{capaId}/anios/{anio}. Requieren emuladores:
 *   npm run test:rules
 */
import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { CID, crearEntorno, firestoreDe } from './helpers';

const RUTA = `companies/${CID}/calendariosJudiciales/ca-madrid/anios/2026`;
const capa = { diasRojos: [], descartados: [] };

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await crearEntorno('demo-zoem-calendarios');
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), RUTA), capa);
  });
});
afterAll(async () => env.cleanup());

describe('calendariosJudiciales', () => {
  it('cualquier miembro activo lee (Viewer incluido)', async () => {
    for (const uid of ['admin', 'gestor', 'usuario', 'viewer']) {
      await assertSucceeds(getDoc(doc(firestoreDe(env, uid), RUTA)));
    }
  });

  it('Admin y Gestor escriben', async () => {
    await assertSucceeds(setDoc(doc(firestoreDe(env, 'admin'), RUTA), capa));
    await assertSucceeds(setDoc(doc(firestoreDe(env, 'gestor'), `companies/${CID}/calendariosJudiciales/pj-28-21/anios/2026`), capa));
  });

  it('Usuario y Viewer no escriben ni borran', async () => {
    for (const uid of ['usuario', 'viewer']) {
      await assertFails(setDoc(doc(firestoreDe(env, uid), RUTA), capa));
      await assertFails(deleteDoc(doc(firestoreDe(env, uid), RUTA)));
    }
  });

  it('otra empresa no lee ni escribe', async () => {
    await assertFails(getDoc(doc(firestoreDe(env, 'ajeno'), RUTA)));
    await assertFails(setDoc(doc(firestoreDe(env, 'ajeno'), RUTA), capa));
  });

  it('sin autenticar no lee ni escribe', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, RUTA)));
    await assertFails(setDoc(doc(db, RUTA), capa));
  });

  it('valida la forma: diasRojos y descartados deben ser listas', async () => {
    const db = firestoreDe(env, 'gestor');
    await assertFails(setDoc(doc(db, RUTA), { diasRojos: 'x', descartados: [] }));
    await assertFails(setDoc(doc(db, RUTA), { diasRojos: [], descartados: {} }));
    await assertFails(setDoc(doc(db, RUTA), { diasRojos: [] }));
  });

  it('rechaza ids de capa o año con formato inesperado', async () => {
    const db = firestoreDe(env, 'gestor');
    await assertFails(setDoc(doc(db, `companies/${CID}/calendariosJudiciales/otra/anios/2026`), capa));
    await assertFails(setDoc(doc(db, `companies/${CID}/calendariosJudiciales/ca-madrid/anios/abc`), capa));
  });
});
