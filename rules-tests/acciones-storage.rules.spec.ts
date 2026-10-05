import { describe, it, beforeAll, afterAll } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { crearEntorno, storageDe, CID } from './helpers';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
let env: RulesTestEnvironment;

const bytes = (n = 10) => new Uint8Array(n).fill(65);

beforeAll(async () => {
  env = await crearEntorno('demo-zoem-acciones-storage');
});
afterAll(async () => {
  await env.cleanup();
});

describe('storage acciones_envios', () => {
  it('miembro no-Viewer sube un .docx', async () => {
    const s = storageDe(env, 'usuario');
    await assertSucceeds(uploadBytes(ref(s, `companies/${CID}/acciones_envios/r1.docx`), bytes(), { contentType: DOCX }));
  });

  it('Viewer no sube', async () => {
    const s = storageDe(env, 'viewer');
    await assertFails(uploadBytes(ref(s, `companies/${CID}/acciones_envios/r2.docx`), bytes(), { contentType: DOCX }));
  });

  it('ajeno no sube a otra empresa', async () => {
    const s = storageDe(env, 'ajeno');
    await assertFails(uploadBytes(ref(s, `companies/${CID}/acciones_envios/r3.docx`), bytes(), { contentType: DOCX }));
  });

  it('solo content-type docx', async () => {
    const s = storageDe(env, 'usuario');
    await assertFails(uploadBytes(ref(s, `companies/${CID}/acciones_envios/r4.docx`), bytes(), { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(s, `companies/${CID}/acciones_envios/r4b.docx`), bytes()));
  });

  it('solo extensión .docx y sin subcarpetas', async () => {
    const s = storageDe(env, 'usuario');
    await assertFails(uploadBytes(ref(s, `companies/${CID}/acciones_envios/r5.exe`), bytes(), { contentType: DOCX }));
    await assertFails(uploadBytes(ref(s, `companies/${CID}/acciones_envios/sub/r6.docx`), bytes(), { contentType: DOCX }));
  });

  it('límite de 10 MB', async () => {
    const s = storageDe(env, 'usuario');
    await assertFails(
      uploadBytes(ref(s, `companies/${CID}/acciones_envios/grande.docx`), bytes(10 * 1024 * 1024 + 1), { contentType: DOCX }),
    );
  });

  it('no se puede sobrescribir (update) ni borrar desde cliente', async () => {
    const s = storageDe(env, 'admin');
    await assertSucceeds(uploadBytes(ref(s, `companies/${CID}/acciones_envios/fijo.docx`), bytes(), { contentType: DOCX }));
    await assertFails(uploadBytes(ref(s, `companies/${CID}/acciones_envios/fijo.docx`), bytes(5), { contentType: DOCX }));
    await assertFails(deleteObject(ref(s, `companies/${CID}/acciones_envios/fijo.docx`)));
  });

  it('miembros leen; ajenos y anónimos no', async () => {
    await assertSucceeds(getBytes(ref(storageDe(env, 'viewer'), `companies/${CID}/acciones_envios/r1.docx`)));
    await assertFails(getBytes(ref(storageDe(env, 'ajeno'), `companies/${CID}/acciones_envios/r1.docx`)));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), `companies/${CID}/acciones_envios/r1.docx`)));
  });

  it('el resto de companies/** sigue igual (no regresión): usuario sube un pdf a casos', async () => {
    const s = storageDe(env, 'usuario');
    await assertSucceeds(uploadBytes(ref(s, `companies/${CID}/casos/k1/doc.pdf`), bytes(), { contentType: 'application/pdf' }));
  });
});
