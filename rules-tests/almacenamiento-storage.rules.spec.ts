import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { crearEntorno, storageDe, CID } from './helpers';
import { derechosParaDoc } from '../functions/src/planes/derechosDoc';
import type { Suscripcion } from '../functions/src/planes/catalogo';

/**
 * Cuota de almacenamiento (documentosMB) en las STORAGE rules: el archivo se rechaza ANTES de subirse,
 * así no quedan huérfanos. Lee companies/{cid}.derechos y companies/{cid}/uso/total (firestore.get entre
 * servicios; en producción exige conceder al agente de servicio de Storage acceso a Firestore).
 * La forma de `derechos` sale de la misma función pura que usa la Function sincronizarDerechos.
 */
// OJO: el proyecto DEBE ser el de `emulators:exec --project demo-zoem` (npm run test:rules). El emulador de Storage resuelve
// firestore.get() contra SU proyecto, no contra el del test: con otro id la rule recibe null y todo falla con 'Null value error'.
let env: RulesTestEnvironment;

const MB = 1_048_576;
const DIA = 86_400_000;
const sus = (p: Partial<Suscripcion>): Suscripcion => ({ plan: 'free', complementos: [], estado: 'activa', origen: 'manual', ...p });
const bytes = (n: number) => new Uint8Array(n).fill(65);
let n = 0;
const rutaCaso = () => `companies/${CID}/casos/k1/docs/root/${++n}_a.pdf`;
const rutaContacto = () => `companies/${CID}/contacts/ct1/root/${++n}_a.pdf`;
const storageDeUid = (uid: string) =>
  uid === 'super' ? env.authenticatedContext('super', { isSuperUser: true }).storage() : storageDe(env, uid);
const subir = (uid: string, ruta: string, tam: number) =>
  uploadBytes(ref(storageDeUid(uid), ruta), bytes(tam), { contentType: 'application/pdf' });

async function empresa(s: Suscripcion | null, usoBytes?: number, ahora = new Date()): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `companies/${CID}`), s ? { name: 'D', suscripcion: s, derechos: derechosParaDoc(s, ahora) } : { name: 'D' });
    if (usoBytes !== undefined) await setDoc(doc(db, `companies/${CID}/uso/total`), { documentosBytes: usoBytes });
  });
}

beforeAll(async () => {
  env = await crearEntorno('demo-zoem');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/super'), { isSuperUser: true });
  });
});

describe('storage · cuota de documentos', () => {
  it('empresa legada (sin derechos): sin límite', async () => {
    await empresa(null, 10_000 * MB);
    await assertSucceeds(subir('usuario', rutaCaso(), 100));
    await assertSucceeds(subir('usuario', rutaContacto(), 100));
  });

  it('free (500 MB): cabe justo => sube; un byte de más => rechazado (casos y contactos)', async () => {
    await empresa(sus({ plan: 'free' }), 500 * MB - 100);
    await assertSucceeds(subir('usuario', rutaCaso(), 100));
    await assertFails(subir('usuario', rutaCaso(), 101));
    await assertSucceeds(subir('usuario', rutaContacto(), 100));
    await assertFails(subir('usuario', rutaContacto(), 101));
  });

  it('sin doc de uso cuenta como 0', async () => {
    await empresa(sus({ plan: 'free' }));
    await assertSucceeds(subir('usuario', rutaCaso(), 1000));
  });

  it('con el cupo ya agotado no sube nada, ni 1 byte', async () => {
    await empresa(sus({ plan: 'free' }), 500 * MB);
    await assertFails(subir('admin', rutaCaso(), 1));
    await assertFails(subir('gestor', rutaContacto(), 1));
  });

  it('plan sin límite (enterprise = null): sube aunque el contador sea enorme', async () => {
    await empresa(sus({ plan: 'enterprise' }), 5_000_000 * MB);
    await assertSucceeds(subir('usuario', rutaCaso(), 100));
  });

  it('la prueba vigente tiene cupo pro; caducada vuelve al de free', async () => {
    await empresa(sus({ plan: 'free', estado: 'prueba', periodoFin: new Date(Date.now() + 3 * DIA) }), 1000 * MB);
    await assertSucceeds(subir('usuario', rutaCaso(), 100)); // pro: 5 GB
    await empresa(sus({ plan: 'free', estado: 'prueba', periodoFin: new Date(Date.now() - 6 * DIA) }), 1000 * MB, new Date(Date.now() - 20 * DIA));
    await assertFails(subir('usuario', rutaCaso(), 100)); // free: 500 MB ya superados
  });

  it('demo terminada (solo lectura): no se sube nada a documentos', async () => {
    await empresa(sus({ plan: 'demo', periodoFin: new Date(Date.now() - 6 * DIA) }), 0, new Date(Date.now() - 20 * DIA));
    await assertFails(subir('admin', rutaCaso(), 10));
  });

  it('el superusuario no está sujeto al cupo', async () => {
    await empresa(sus({ plan: 'free' }), 500 * MB);
    await assertSucceeds(subir('super', rutaCaso(), 100));
  });

  it('se siguen exigiendo rol y tenant: Viewer y ajenos no suben ni con cupo', async () => {
    await empresa(sus({ plan: 'free' }), 0);
    await assertFails(subir('viewer', rutaCaso(), 10));
    await assertFails(subir('ajeno', rutaCaso(), 10));
  });

  it('el tope defensivo de 50 MB por archivo sigue vigente', async () => {
    await empresa(sus({ plan: 'enterprise' }), 0);
    await assertFails(subir('usuario', rutaCaso(), 50 * MB + 1));
  });

  it('el resto de rutas de la empresa NO consumen esta cuota (acciones, facturas recibidas)', async () => {
    await empresa(sus({ plan: 'pro' }), 5_000 * MB);
    await assertSucceeds(subir('gestor', `companies/${CID}/facturas_recibidas/f1.pdf`, 10));
    await assertSucceeds(subir('usuario', `companies/${CID}/docTemplates/t1/plantilla.html`, 10));
  });

  it('no se puede esquivar el cupo subiendo a otra ruta equivalente del bloque genérico', async () => {
    await empresa(sus({ plan: 'free' }), 500 * MB);
    // mayúsculas / segmentos extra siguen dentro de casos/*/docs/ o contacts/
    await assertFails(subir('usuario', `companies/${CID}/casos/k1/docs/a/b/c/x.pdf`, 10));
    await assertFails(subir('usuario', `companies/${CID}/contacts/ct1/x.pdf`, 10));
  });
});
