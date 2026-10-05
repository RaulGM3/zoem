/**
 * Tests de reglas de facturas_recibidas (Firestore + Storage). Requieren emuladores:
 *
 *   npx firebase emulators:exec --only firestore,storage --project demo-zoem \
 *     "npx vitest run --config rules-tests/vitest.config.ts"
 *
 * No forman parte de `ng test` (viven fuera de `src/`).
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

const CID = 'c1';
const FACT = `companies/${CID}/facturas_recibidas`;
const PATH_ADJ = `companies/${CID}/facturas_recibidas/F1.pdf`;
const PATH_OTRO = `companies/${CID}/otros/doc.pdf`;

let env: RulesTestEnvironment;

const claims = (role: string, companyId = CID) => ({ companyId, role, estado: 'activo' });

const ctx = (uid: string, role: string, companyId = CID) => env.authenticatedContext(uid, claims(role, companyId));

async function sembrarMiembros() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const [uid, role] of [['admin', 'Admin'], ['gestor', 'Gestor'], ['usuario', 'Usuario'], ['viewer', 'Viewer']]) {
      await setDoc(doc(db, `companies/${CID}/members/${uid}`), { role, estado: 'activo' });
    }
  });
}

const ahora = () => serverTimestamp();

const nuevaFactura = (uid: string, extra: Record<string, unknown> = {}) => ({
  companyId: CID,
  numeroRecepcion: 1,
  tipoFactura: 'F1',
  claveOperacion: '01',
  proveedor: { nombre: 'Proveedor SL', nif: 'B12345674' },
  numero: 'FA-1',
  fechaExpedicion: '2026-04-02',
  fechaRegistro: '2026-04-05',
  periodo303: { ejercicio: 2026, trimestre: 2 },
  lineasIva: [{ base: 100, tipo: 21, cuota: 21 }],
  total: 121,
  porcentajeDeducible: 100,
  concepto: 'Material',
  qrValidacion: { estado: 'sin_qr' },
  extraccion: { origen: 'manual', discrepancias: [] },
  estado: 'registrada',
  createdBy: uid,
  createdAt: ahora(),
  ...extra,
});

/** Doc ya existente (sembrado sin rules). */
async function sembrarFactura(extra: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), `${FACT}/f1`), { ...nuevaFactura('gestor'), createdAt: new Date(), ...extra });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-zoem',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await sembrarMiembros();
});

describe('firestore facturas_recibidas', () => {
  it('anónimo denegado', async () => {
    await sembrarFactura();
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `${FACT}/f1`)));
  });

  it.each(['usuario', 'viewer'])('%s no lee ni escribe', async (uid) => {
    await sembrarFactura();
    const db = ctx(uid, uid === 'usuario' ? 'Usuario' : 'Viewer').firestore();
    await assertFails(getDoc(doc(db, `${FACT}/f1`)));
    await assertFails(setDoc(doc(db, `${FACT}/f2`), nuevaFactura(uid)));
  });

  it.each(['admin', 'gestor'])('%s lee y crea', async (uid) => {
    await sembrarFactura();
    const db = ctx(uid, uid === 'admin' ? 'Admin' : 'Gestor').firestore();
    await assertSucceeds(getDoc(doc(db, `${FACT}/f1`)));
    await assertSucceeds(setDoc(doc(db, `${FACT}/f2`), nuevaFactura(uid)));
  });

  it('otro tenant denegado', async () => {
    await sembrarFactura();
    await assertFails(getDoc(doc(ctx('forastero', 'Gestor', 'c2').firestore(), `${FACT}/f1`)));
  });

  it('create: qrValidacion del cliente solo sin_qr | pendiente', async () => {
    const db = ctx('gestor', 'Gestor').firestore();
    await assertSucceeds(setDoc(doc(db, `${FACT}/a`), nuevaFactura('gestor', { qrValidacion: { estado: 'pendiente' } })));
    await assertFails(setDoc(doc(db, `${FACT}/b`), nuevaFactura('gestor', { qrValidacion: { estado: 'encontrada' } })));
    await assertFails(setDoc(doc(db, `${FACT}/c`), nuevaFactura('gestor', { qrValidacion: { estado: 'sin_qr', at: new Date() } })));
  });

  it('create: valida claves, tipos, createdBy, companyId, estado y adjunto', async () => {
    const db = ctx('gestor', 'Gestor').firestore();
    await assertFails(setDoc(doc(db, `${FACT}/x1`), nuevaFactura('gestor', { campoExtra: 1 })));
    await assertFails(setDoc(doc(db, `${FACT}/x2`), nuevaFactura('otro')));
    await assertFails(setDoc(doc(db, `${FACT}/x3`), nuevaFactura('gestor', { companyId: 'c2' })));
    await assertFails(setDoc(doc(db, `${FACT}/x4`), nuevaFactura('gestor', { estado: 'anulada' })));
    await assertFails(setDoc(doc(db, `${FACT}/x5`), nuevaFactura('gestor', { porcentajeDeducible: 101 })));
    await assertFails(setDoc(doc(db, `${FACT}/x6`), nuevaFactura('gestor', { tipoFactura: 'R1' })));
    await assertFails(setDoc(doc(db, `${FACT}/x7`), nuevaFactura('gestor', { total: '121' })));
    await assertFails(setDoc(doc(db, `${FACT}/x7b`), nuevaFactura('gestor', { total: -1 })));
    await assertFails(setDoc(doc(db, `${FACT}/x8`), nuevaFactura('gestor', { adjunto: { storagePath: 'companies/c2/facturas_recibidas/a.pdf' } })));
    await assertSucceeds(setDoc(doc(db, `${FACT}/ok`), nuevaFactura('gestor', { adjunto: { storagePath: PATH_ADJ, nombre: 'a.pdf' } })));
  });

  it('create no pisa un doc existente (es update)', async () => {
    await sembrarFactura();
    const db = ctx('gestor', 'Gestor').firestore();
    await assertFails(setDoc(doc(db, `${FACT}/f1`), nuevaFactura('gestor')));
  });

  it('delete denegado siempre', async () => {
    await sembrarFactura();
    await assertFails(deleteDoc(doc(ctx('admin', 'Admin').firestore(), `${FACT}/f1`)));
  });

  describe('update', () => {
    const audit = (uid = 'gestor') => ({ updatedBy: uid, updatedAt: ahora() });

    it('permite editar campos mutables con auditoría', async () => {
      await sembrarFactura();
      const db = ctx('gestor', 'Gestor').firestore();
      await assertSucceeds(updateDoc(doc(db, `${FACT}/f1`), { concepto: 'Otro', porcentajeDeducible: 50, ...audit() }));
      await assertFails(updateDoc(doc(db, `${FACT}/f1`), { concepto: 'Sin auditoría' }));
    });

    it('qrValidacion no se puede cambiar desde el cliente', async () => {
      await sembrarFactura();
      const db = ctx('gestor', 'Gestor').firestore();
      await assertFails(updateDoc(doc(db, `${FACT}/f1`), { qrValidacion: { estado: 'encontrada' }, ...audit() }));
    });

    it.each(['proveedor', 'numero', 'numeroRecepcion', 'companyId', 'createdBy'])('%s es inmutable', async (k) => {
      await sembrarFactura();
      const valor: Record<string, unknown> = {
        proveedor: { nombre: 'Otro', nif: 'A12345674' },
        numero: 'FA-2',
        numeroRecepcion: 2,
        companyId: 'c2',
        createdBy: 'otro',
      };
      await assertFails(updateDoc(doc(ctx('gestor', 'Gestor').firestore(), `${FACT}/f1`), { [k]: valor[k], ...audit() }));
    });

    it('anular exige anuladaPor/At; reactivar conserva el historial', async () => {
      await sembrarFactura();
      const db = ctx('gestor', 'Gestor').firestore();
      const d = doc(db, `${FACT}/f1`);
      await assertFails(updateDoc(d, { estado: 'anulada', ...audit() }));
      await assertSucceeds(updateDoc(d, { estado: 'anulada', anuladaPor: 'gestor', anuladaAt: ahora(), ...audit() }));
      // una anulada no se edita
      await assertFails(updateDoc(d, { concepto: 'x', ...audit() }));
      // reactivar con historial intacto
      await assertSucceeds(updateDoc(d, { estado: 'registrada', concepto: 'Reactivada', ...audit() }));
    });

    it('reactivar no puede borrar el historial de anulación', async () => {
      await sembrarFactura({ estado: 'anulada', anuladaPor: 'gestor', anuladaAt: new Date() });
      const db = ctx('gestor', 'Gestor').firestore();
      await assertFails(updateDoc(doc(db, `${FACT}/f1`), { estado: 'registrada', anuladaPor: 'otro', ...audit() }));
      await assertSucceeds(updateDoc(doc(db, `${FACT}/f1`), { estado: 'registrada', ...audit() }));
    });

    it('Usuario y Viewer no actualizan', async () => {
      await sembrarFactura();
      await assertFails(updateDoc(doc(ctx('usuario', 'Usuario').firestore(), `${FACT}/f1`), { concepto: 'x', ...audit('usuario') }));
    });
  });
});

describe('firestore facturas_recibidas_meta', () => {
  const m = (uid: string, role: string) => doc(ctx(uid, role).firestore(), `companies/${CID}/facturas_recibidas_meta/2026`);

  it('manager crea con 1 y solo sube +1', async () => {
    await assertFails(setDoc(m('gestor', 'Gestor'), { ultimo: 5 }));
    await assertSucceeds(setDoc(m('gestor', 'Gestor'), { ultimo: 1 }));
    await assertFails(updateDoc(m('gestor', 'Gestor'), { ultimo: 3 }));
    await assertFails(updateDoc(m('gestor', 'Gestor'), { ultimo: 1 }));
    await assertSucceeds(updateDoc(m('gestor', 'Gestor'), { ultimo: 2 }));
    await assertFails(deleteDoc(m('gestor', 'Gestor')));
  });

  it('Usuario/Viewer denegados', async () => {
    await assertFails(setDoc(m('usuario', 'Usuario'), { ultimo: 1 }));
    await assertFails(getDoc(m('viewer', 'Viewer')));
  });
});

describe('storage facturas_recibidas', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const st = (uid: string, role: string, cid = CID) => ctx(uid, role, cid).storage();

  it('Admin/Gestor suben y leen', async () => {
    for (const [uid, role] of [['admin', 'Admin'], ['gestor', 'Gestor']]) {
      await assertSucceeds(uploadBytes(ref(st(uid, role), PATH_ADJ), bytes, { contentType: 'application/pdf' }));
      await assertSucceeds(getBytes(ref(st(uid, role), PATH_ADJ)));
    }
  });

  it('solo PDF o imagen en facturas_recibidas', async () => {
    const meta = (contentType: string) => ({ contentType });
    const r = (n: string) => ref(st('gestor', 'Gestor'), `companies/${CID}/facturas_recibidas/${n}`);
    await assertSucceeds(uploadBytes(r('a.pdf'), bytes, meta('application/pdf')));
    await assertSucceeds(uploadBytes(r('a.jpg'), bytes, meta('image/jpeg')));
    await assertFails(uploadBytes(r('a.html'), bytes, meta('text/html')));
    await assertFails(uploadBytes(r('a.svg'), bytes, meta('image/svg+xml')));
  });

  it('Usuario y Viewer denegados en facturas_recibidas (el match genérico las excluye por nombre de objeto)', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await uploadBytes(ref(c.storage(), PATH_ADJ), bytes);
    });
    await assertFails(getBytes(ref(st('usuario', 'Usuario'), PATH_ADJ)));
    await assertFails(uploadBytes(ref(st('usuario', 'Usuario'), PATH_ADJ), bytes));
    await assertFails(getBytes(ref(st('viewer', 'Viewer'), PATH_ADJ)));
  });

  it('el resto del tenant sigue igual: Usuario escribe, Viewer solo lee', async () => {
    await assertSucceeds(uploadBytes(ref(st('usuario', 'Usuario'), PATH_OTRO), bytes));
    await assertSucceeds(getBytes(ref(st('viewer', 'Viewer'), PATH_OTRO)));
    await assertFails(uploadBytes(ref(st('viewer', 'Viewer'), PATH_OTRO), bytes));
  });

  it('otro tenant denegado y sin delete de cliente', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await uploadBytes(ref(c.storage(), PATH_ADJ), bytes);
    });
    await assertFails(getBytes(ref(st('gestor', 'Gestor', 'c2'), PATH_ADJ)));
    await assertFails(deleteObject(ref(st('admin', 'Admin'), PATH_ADJ)));
  });
});
