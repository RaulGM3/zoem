import { describe, it, beforeAll, afterAll } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { crearEntorno, storageDe, CID } from './helpers';

let env: RulesTestEnvironment;

const bytes = (n = 10) => new Uint8Array(n).fill(65);
const LOGO = `companies/${CID}/branding/logo`;
const PNG = { contentType: 'image/png' };
const superStorage = () =>
  env.authenticatedContext('super', { isSuperUser: true }).storage();

beforeAll(async () => {
  env = await crearEntorno('demo-zoem-branding-storage');
});
afterAll(async () => {
  await env.cleanup();
});

describe('storage branding/logo', () => {
  it('Admin crea, actualiza (jpeg) y borra el logo', async () => {
    const s = storageDe(env, 'admin');
    await assertSucceeds(uploadBytes(ref(s, LOGO), bytes(), PNG));
    await assertSucceeds(uploadBytes(ref(s, LOGO), bytes(20), { contentType: 'image/jpeg' }));
    await assertSucceeds(deleteObject(ref(s, LOGO)));
  });

  it('superusuario crea y borra', async () => {
    const s = superStorage();
    await assertSucceeds(uploadBytes(ref(s, LOGO), bytes(), PNG));
    await assertSucceeds(deleteObject(ref(s, LOGO)));
  });

  it('Gestor, Usuario y Viewer no escriben ni borran', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), LOGO), bytes(), PNG);
    });
    for (const uid of ['gestor', 'usuario', 'viewer']) {
      const s = storageDe(env, uid);
      await assertFails(uploadBytes(ref(s, LOGO), bytes(), PNG));
      await assertFails(deleteObject(ref(s, LOGO)));
    }
  });

  it('Admin de otra empresa no escribe ni borra', async () => {
    const s = storageDe(env, 'ajeno');
    await assertFails(uploadBytes(ref(s, LOGO), bytes(), PNG));
    await assertFails(deleteObject(ref(s, LOGO)));
  });

  it('anónimo no escribe ni lee', async () => {
    const s = env.unauthenticatedContext().storage();
    await assertFails(uploadBytes(ref(s, LOGO), bytes(), PNG));
    await assertFails(getBytes(ref(s, LOGO)));
  });

  it('rechaza svg, webp y sin contentType', async () => {
    const s = storageDe(env, 'admin');
    await assertFails(uploadBytes(ref(s, LOGO), bytes(), { contentType: 'image/svg+xml' }));
    await assertFails(uploadBytes(ref(s, LOGO), bytes(), { contentType: 'image/webp' }));
    await assertFails(uploadBytes(ref(s, LOGO), bytes(), { contentType: 'application/pdf' }));
  });

  it('rechaza >= 1 MB y acepta justo por debajo', async () => {
    const s = storageDe(env, 'admin');
    await assertFails(uploadBytes(ref(s, LOGO), bytes(2 * 1024 * 1024), PNG));
    await assertFails(uploadBytes(ref(s, LOGO), bytes(1024 * 1024), PNG));
    await assertSucceeds(uploadBytes(ref(s, LOGO), bytes(1024 * 1024 - 1), PNG));
  });

  it('solo el objeto llamado logo; sin subcarpetas', async () => {
    const s = storageDe(env, 'admin');
    await assertFails(uploadBytes(ref(s, `companies/${CID}/branding/otro`), bytes(), PNG));
    await assertFails(uploadBytes(ref(s, `companies/${CID}/branding/sub/logo`), bytes(), PNG));
  });

  it('el match genérico no permite escribir branding a un no-admin', async () => {
    const s = storageDe(env, 'usuario');
    await assertFails(uploadBytes(ref(s, `companies/${CID}/branding/otro`), bytes(), PNG));
    await assertFails(uploadBytes(ref(s, `companies/${CID}/branding/sub/logo`), bytes(), PNG));
  });

  it('el Admin tampoco escribe branding con otro tipo a través del genérico (pdf en otro nombre)', async () => {
    const s = storageDe(env, 'admin');
    await assertFails(uploadBytes(ref(s, `companies/${CID}/branding/doc.pdf`), bytes(), { contentType: 'application/pdf' }));
  });

  it('miembros (incluido Viewer) leen; ajeno no', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), LOGO), bytes(), PNG);
    });
    await assertSucceeds(getBytes(ref(storageDe(env, 'viewer'), LOGO)));
    await assertSucceeds(getBytes(ref(storageDe(env, 'gestor'), LOGO)));
    await assertFails(getBytes(ref(storageDe(env, 'ajeno'), LOGO)));
  });

  it('no regresión: usuario sigue subiendo a rutas genéricas (invoices)', async () => {
    const s = storageDe(env, 'usuario');
    await assertSucceeds(uploadBytes(ref(s, `companies/${CID}/invoices/doc.pdf`), bytes(), { contentType: 'application/pdf' }));
  });
});
