import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

export const CID = 'c1';
export const OTRA = 'c2';

export type Rol = 'Admin' | 'Gestor' | 'Usuario' | 'Viewer';

/** uid -> (empresa, rol): miembros sembrados en Firestore y claims equivalentes para Storage. */
export const USUARIOS: Record<string, { cid: string; rol: Rol }> = {
  admin: { cid: CID, rol: 'Admin' },
  gestor: { cid: CID, rol: 'Gestor' },
  usuario: { cid: CID, rol: 'Usuario' },
  viewer: { cid: CID, rol: 'Viewer' },
  ajeno: { cid: OTRA, rol: 'Admin' },
};

export async function crearEntorno(proyecto: string): Promise<RulesTestEnvironment> {
  const env = await initializeTestEnvironment({
    projectId: proyecto,
    firestore: { rules: readFileSync(resolve('firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve('storage.rules'), 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, u] of Object.entries(USUARIOS)) {
      await setDoc(doc(db, `companies/${u.cid}/members/${uid}`), {
        userId: uid, companyId: u.cid, role: u.rol, estado: 'activo',
      });
    }
    await setDoc(doc(db, 'users/super'), { isSuperUser: true });
  });
  return env;
}

export function firestoreDe(env: RulesTestEnvironment, uid: string) {
  return env.authenticatedContext(uid).firestore();
}

/** Claims que sincroniza functions/src/customClaims.ts (las Storage rules leen el token). */
export function storageDe(env: RulesTestEnvironment, uid: string) {
  const u = USUARIOS[uid];
  return env.authenticatedContext(uid, { companyId: u.cid, role: u.rol, estado: 'activo', isSuperUser: false }).storage();
}
