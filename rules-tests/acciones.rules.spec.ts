import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs,
} from 'firebase/firestore';
import { crearEntorno, firestoreDe, CID } from './helpers';

let env: RulesTestEnvironment;

const accion = (over: Record<string, unknown> = {}) => ({
  companyId: CID,
  nombre: 'Bienvenida',
  ambito: 'contacto',
  asunto: 'Hola {{nombre}}',
  cuerpo: 'Texto',
  canales: ['gmail', 'whatsapp'],
  activa: true,
  createdBy: 'gestor',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...over,
});

const registro = (uid: string, over: Record<string, unknown> = {}) => ({
  companyId: CID,
  accionId: 'a1',
  accionNombre: 'Bienvenida',
  contactoIds: ['k1'],
  canal: 'gmail',
  createdBy: uid,
  createdAt: serverTimestamp(),
  ...over,
});

beforeAll(async () => {
  env = await crearEntorno('demo-zoem-acciones');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `companies/${CID}/acciones/existente`), {
      ...accion({ createdAt: new Date(), updatedAt: new Date() }),
    });
    await setDoc(doc(db, `companies/${CID}/accion_registros/r0`), {
      ...registro('usuario', { createdAt: new Date() }),
    });
  });
});

describe('acciones', () => {
  it('cualquier miembro de la empresa lee', async () => {
    for (const uid of ['admin', 'gestor', 'usuario', 'viewer']) {
      await assertSucceeds(getDoc(doc(firestoreDe(env, uid), `companies/${CID}/acciones/existente`)));
    }
    await assertSucceeds(getDocs(collection(firestoreDe(env, 'usuario'), `companies/${CID}/acciones`)));
  });

  it('un ajeno a la empresa no lee ni lista', async () => {
    await assertFails(getDoc(doc(firestoreDe(env, 'ajeno'), `companies/${CID}/acciones/existente`)));
  });

  it('sin autenticar no lee', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, `companies/${CID}/acciones/existente`)));
  });

  it('Admin y Gestor crean', async () => {
    await assertSucceeds(setDoc(doc(firestoreDe(env, 'gestor'), `companies/${CID}/acciones/n1`), accion()));
    await assertSucceeds(
      setDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}/acciones/n2`), accion({ createdBy: 'admin' })),
    );
  });

  it('Usuario y Viewer NO crean', async () => {
    await assertFails(
      setDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/acciones/n3`), accion({ createdBy: 'usuario' })),
    );
    await assertFails(
      setDoc(doc(firestoreDe(env, 'viewer'), `companies/${CID}/acciones/n4`), accion({ createdBy: 'viewer' })),
    );
  });

  it('no se puede crear en otra empresa', async () => {
    await assertFails(setDoc(doc(firestoreDe(env, 'ajeno'), `companies/${CID}/acciones/n5`), accion({ createdBy: 'ajeno' })));
  });

  it('valida campos: ámbito, canales, tipos y campos desconocidos', async () => {
    const g = firestoreDe(env, 'gestor');
    const ref = (id: string) => doc(g, `companies/${CID}/acciones/${id}`);
    await assertFails(setDoc(ref('v1'), accion({ ambito: 'otro' })));
    await assertFails(setDoc(ref('v2'), accion({ canales: ['telegram'] })));
    await assertFails(setDoc(ref('v3'), accion({ canales: [] })));
    await assertFails(setDoc(ref('v4'), accion({ nombre: '' })));
    await assertFails(setDoc(ref('v5'), accion({ nombre: 123 })));
    await assertFails(setDoc(ref('v6'), accion({ activa: 'si' })));
    await assertFails(setDoc(ref('v7'), accion({ extra: 'x' })));
    await assertFails(setDoc(ref('v8'), accion({ cuerpo: 'x'.repeat(10001) })));
    await assertFails(setDoc(ref('v9'), accion({ docTemplateId: 5 })));
    await assertSucceeds(setDoc(ref('ok1'), accion({ ambito: 'caso', plantillaId: 'p1', hitoPlantillaId: 'h1', docTemplateId: 't1' })));
  });

  it('createdBy debe ser el autor y createdAt la hora del servidor', async () => {
    const g = firestoreDe(env, 'gestor');
    await assertFails(setDoc(doc(g, `companies/${CID}/acciones/s1`), accion({ createdBy: 'admin' })));
    await assertFails(setDoc(doc(g, `companies/${CID}/acciones/s2`), accion({ createdAt: new Date(2000, 1, 1) })));
  });

  it('Gestor actualiza; Usuario no; no puede mover companyId ni createdBy', async () => {
    const ref = (uid: string) => doc(firestoreDe(env, uid), `companies/${CID}/acciones/existente`);
    await assertSucceeds(updateDoc(ref('gestor'), { nombre: 'Nuevo', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref('usuario'), { nombre: 'Hack', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref('gestor'), { createdBy: 'usuario', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref('gestor'), { companyId: 'c2', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref('gestor'), { ambito: 'nada', updatedAt: serverTimestamp() }));
  });

  it('Gestor borra; Usuario no', async () => {
    await assertFails(deleteDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/acciones/existente`)));
    await assertSucceeds(deleteDoc(doc(firestoreDe(env, 'gestor'), `companies/${CID}/acciones/existente`)));
  });
});

describe('accion_registros', () => {
  it('miembros leen; ajenos no', async () => {
    await assertSucceeds(getDoc(doc(firestoreDe(env, 'viewer'), `companies/${CID}/accion_registros/r0`)));
    await assertFails(getDoc(doc(firestoreDe(env, 'ajeno'), `companies/${CID}/accion_registros/r0`)));
  });

  it('Usuario/Gestor/Admin crean el suyo; Viewer no', async () => {
    for (const uid of ['usuario', 'gestor', 'admin']) {
      await assertSucceeds(setDoc(doc(firestoreDe(env, uid), `companies/${CID}/accion_registros/${uid}`), registro(uid)));
    }
    await assertFails(setDoc(doc(firestoreDe(env, 'viewer'), `companies/${CID}/accion_registros/v`), registro('viewer')));
  });

  it('exige createdBy == uid, createdAt == request.time y companyId == cid', async () => {
    const u = firestoreDe(env, 'usuario');
    await assertFails(setDoc(doc(u, `companies/${CID}/accion_registros/x1`), registro('admin')));
    await assertFails(setDoc(doc(u, `companies/${CID}/accion_registros/x2`), registro('usuario', { createdAt: new Date(2000, 1, 1) })));
    await assertFails(setDoc(doc(u, `companies/${CID}/accion_registros/x3`), registro('usuario', { companyId: 'c2' })));
  });

  it('valida canal, contactoIds y campos desconocidos; admite opcionales', async () => {
    const u = firestoreDe(env, 'usuario');
    const ref = (id: string) => doc(u, `companies/${CID}/accion_registros/${id}`);
    await assertFails(setDoc(ref('y1'), registro('usuario', { canal: 'sms' })));
    await assertFails(setDoc(ref('y2'), registro('usuario', { contactoIds: 'k1' })));
    await assertFails(setDoc(ref('y3'), registro('usuario', { extra: 1 })));
    await assertSucceeds(
      setDoc(ref('ok'), registro('usuario', {
        casoId: 'cs1', hitoId: 'h1', docPath: `companies/${CID}/acciones_envios/ok.docx`,
      })),
    );
  });

  it('nunca se actualiza ni se borra desde cliente (ni Admin)', async () => {
    const a = doc(firestoreDe(env, 'admin'), `companies/${CID}/accion_registros/r0`);
    await assertFails(updateDoc(a, { canal: 'mail' }));
    await assertFails(deleteDoc(a));
  });
});
