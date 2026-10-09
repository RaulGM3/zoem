import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { crearEntorno, firestoreDe, CID } from './helpers';

let env: RulesTestEnvironment;
const ruta = `companies/${CID}`;
const LOGO = { path: `companies/${CID}/branding/logo`, url: 'u', contentType: 'image/png', updatedAt: '2026-01-01T00:00:00Z' };

beforeAll(async () => {
  env = await crearEntorno('demo-zoem-companies');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), ruta), {
      name: 'Acme', slug: 'acme', plan: 'basic', isActive: true, createdAt: 'x',
    });
  });
});

const upd = (uid: string, data: Record<string, unknown>) => updateDoc(doc(firestoreDe(env, uid), ruta), data);
const superDb = () => doc(env.authenticatedContext('super').firestore(), ruta);

describe('companies/{cid} update', () => {
  it('Gestor actualiza saldoBancario y verifactu', async () => {
    await assertSucceeds(upd('gestor', { saldoBancario: 100 }));
    await assertSucceeds(upd('gestor', { verifactu: { enabled: true, sandbox: true } }));
  });

  it('Gestor no toca logo, plan ni isActive', async () => {
    await assertFails(upd('gestor', { logo: LOGO }));
    await assertFails(upd('gestor', { plan: 'pro' }));
    await assertFails(upd('gestor', { isActive: false }));
    await assertFails(upd('gestor', { slug: 'otro' }));
  });

  it('Gestor no puede colar logo junto a un campo permitido', async () => {
    await assertFails(upd('gestor', { saldoBancario: 5, logo: LOGO }));
  });

  it('Admin pone y quita logo', async () => {
    await assertSucceeds(upd('admin', { logo: LOGO }));
    await assertSucceeds(updateDoc(doc(firestoreDe(env, 'admin'), ruta), { logo: null }));
  });

  it('Admin no toca plan, isActive ni slug', async () => {
    await assertFails(upd('admin', { plan: 'pro' }));
    await assertFails(upd('admin', { isActive: false }));
    await assertFails(upd('admin', { slug: 'otro' }));
  });

  it('Gestor y Admin no se auto-asignan suscripcion (ni la editan)', async () => {
    const SUS = { plan: 'enterprise', complementos: [], estado: 'activa', origen: 'manual' };
    await assertFails(upd('gestor', { suscripcion: SUS }));
    await assertFails(upd('admin', { suscripcion: SUS }));
    await assertFails(upd('admin', { suscripcion: null }));
    await assertFails(upd('admin', { saldoBancario: 5, 'suscripcion.plan': 'pro' }));
  });

  it('Admin no se marca ni se desmarca como demo/autoservicio ni cambia createdBy', async () => {
    await assertFails(upd('admin', { esDemo: true }));
    await assertFails(upd('admin', { esDemo: false }));
    await assertFails(upd('admin', { autoservicio: true }));
    await assertFails(upd('admin', { createdBy: 'otro' }));
  });

  it('Usuario y Viewer no actualizan', async () => {
    await assertFails(upd('usuario', { saldoBancario: 1 }));
    await assertFails(upd('viewer', { saldoBancario: 1 }));
  });

  it('Admin de otra empresa no actualiza', async () => {
    await assertFails(upd('ajeno', { logo: LOGO }));
  });

  it('superusuario actualiza todo', async () => {
    await assertSucceeds(updateDoc(superDb(), { plan: 'pro', isActive: false, logo: LOGO }));
    await assertSucceeds(updateDoc(superDb(), { suscripcion: { plan: 'pro', complementos: [], estado: 'activa', origen: 'manual' } }));
  });
});
