import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { crearEntorno, firestoreDe, CID } from './helpers';

let env: RulesTestEnvironment;

const ruta = (id: string) => `companies/${CID}/docTemplates/${id}`;

beforeAll(async () => {
  env = await crearEntorno('demo-zoem-doc-templates');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Plantilla anterior al soft delete: no tiene el campo `deleted`.
    await setDoc(doc(db, ruta('legacy')), { companyId: CID, name: 'Legacy', html: '<p>x</p>' });
    await setDoc(doc(db, ruta('activa')), { companyId: CID, name: 'Activa', html: '<p>x</p>', deleted: false });
    await setDoc(doc(db, ruta('borrada')), { companyId: CID, name: 'Borrada', html: '<p>x</p>', deleted: true });
  });
});

describe('docTemplates get', () => {
  it('un miembro lee una plantilla sin campo deleted (legacy)', async () => {
    await assertSucceeds(getDoc(doc(firestoreDe(env, 'usuario'), ruta('legacy'))));
  });

  it('un miembro lee una plantilla activa', async () => {
    await assertSucceeds(getDoc(doc(firestoreDe(env, 'usuario'), ruta('activa'))));
  });

  it('un miembro no lee una plantilla soft-deleted', async () => {
    await assertFails(getDoc(doc(firestoreDe(env, 'usuario'), ruta('borrada'))));
  });

  it('otra empresa no lee la plantilla', async () => {
    await assertFails(getDoc(doc(firestoreDe(env, 'ajeno'), ruta('legacy'))));
  });
});
