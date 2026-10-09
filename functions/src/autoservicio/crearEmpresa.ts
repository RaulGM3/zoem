import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { assertCompanyAccess } from '../lib/assertCompanyAccess';
import { demoExpirada, esEmpresaDemo } from './suscripcion';
import { construirLlamadasDemo } from './llamadasDemo';
import { empresaAutoservicioDoc, empresaDemoDoc, miembroAdminDoc } from './construir';
import { autorizadoParaAutoservicio, generarSlug, validarAlta, validarAltaDemo, type TokenAuth } from './validar';

/**
 * Altas en autoservicio. Las rules NO dejan crear empresas desde el cliente
 * (`companies create: isSuper()`), así que el alta pasa por estos callables, que
 * corren con Admin SDK y por tanto validan TODO aquí.
 *
 * Límite "1 despacho propio + 1 demo por usuario": se garantiza con un doc
 * `empresasAutoservicio/{uid}` que solo escribe el servidor (las rules lo
 * deniegan por defecto). No se usa `users/{uid}`: el usuario puede editar su
 * propio doc y saltarse el límite.
 *
 * App Check ENFORCED (fase 3): frena altas automatizadas. El cliente lo inicializa en app.config.ts
 * (ReCaptchaEnterpriseProvider) sobre la MISMA app que Functions, así que el token viaja solo.
 * Antes de desplegar hay que registrar los proveedores en la consola (ver informe de la fase 3).
 */

type Respuesta = { companyId: string; yaExistia: boolean };

function exigirSesion(request: CallableRequest<unknown>): { uid: string; email: string; token: TokenAuth & { name?: string } } {
  const uid = request.auth?.uid;
  const email = (request.auth?.token?.email as string | undefined)?.toLowerCase();
  if (!uid || !email) throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
  const token = request.auth!.token as unknown as TokenAuth & { name?: string };
  if (!autorizadoParaAutoservicio(token)) {
    throw new HttpsError('failed-precondition', 'Verifica tu correo electrónico antes de crear tu despacho');
  }
  return { uid, email, token };
}

function sufijo(id: string): string {
  return id.slice(0, 5).toLowerCase();
}

export const crearEmpresaAutoservicio = onCall<unknown, Promise<Respuesta>>(
  { enforceAppCheck: true },
  async (request) => {
    const { uid, email, token } = exigirSesion(request);
    const v = validarAlta(request.data);
    if (!v.ok) throw new HttpsError('invalid-argument', `Datos no válidos: ${v.campos.join(', ')}`);

    const db = admin.firestore();
    const ownerRef = db.doc(`empresasAutoservicio/${uid}`);
    const userRef = db.doc(`users/${uid}`);
    const companyRef = db.collection('companies').doc();
    const ahora = new Date();

    await db.runTransaction(async (tx) => {
      const owner = await tx.get(ownerRef);
      const previa = owner.get('companyId') as string | undefined;
      // Si el superusuario borró aquella empresa, el límite se libera.
      if (previa && (await tx.get(db.doc(`companies/${previa}`))).exists) {
        throw new HttpsError('already-exists', 'Ya tienes un despacho creado');
      }
      const user = await tx.get(userRef);

      tx.set(companyRef, {
        ...empresaAutoservicioDoc(v.valor, { uid, email, slug: generarSlug(v.valor.nombre, sufijo(companyRef.id)), ahora }),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(companyRef.collection('members').doc(uid), {
        ...miembroAdminDoc(companyRef.id, { uid, email, nombreCompleto: token.name }),
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(ownerRef, { companyId: companyRef.id, createdAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(
        userRef,
        user.exists
          ? { ...(user.get('companyId') ? {} : { companyId: companyRef.id, role: 'admin' }), updatedAt: FieldValue.serverTimestamp() }
          : {
              email, displayName: token.name ?? null, isSuperUser: false, companyId: companyRef.id, role: 'admin',
              createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
            },
        { merge: true },
      );
    });

    logger.info('Empresa de autoservicio creada', { uid, companyId: companyRef.id });
    return { companyId: companyRef.id, yaExistia: false };
  },
);

export const crearDespachoDemo = onCall<unknown, Promise<Respuesta>>(
  { enforceAppCheck: true },
  async (request) => {
    const { uid, email, token } = exigirSesion(request);
    const v = validarAltaDemo(request.data);
    if (!v.ok) throw new HttpsError('invalid-argument', 'Falta el nombre del despacho');

    const db = admin.firestore();
    const ownerRef = db.doc(`empresasAutoservicio/${uid}`);
    const companyRef = db.collection('companies').doc();
    const ahora = new Date();

    const existente = await db.runTransaction(async (tx) => {
      const owner = await tx.get(ownerRef);
      const previa = owner.get('demoCompanyId') as string | undefined;
      // Máximo 1 demo por usuario: si ya existe se devuelve (idempotente).
      if (previa && (await tx.get(db.doc(`companies/${previa}`))).exists) return previa;

      tx.set(companyRef, {
        ...empresaDemoDoc(v.valor.nombre, { uid, email, slug: generarSlug(`demo ${v.valor.nombre}`, sufijo(companyRef.id)), ahora, zonaHoraria: v.valor.zonaHoraria }),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(companyRef.collection('members').doc(uid), {
        ...miembroAdminDoc(companyRef.id, { uid, email, nombreCompleto: token.name }),
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(ownerRef, { demoCompanyId: companyRef.id, demoCreatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return null;
    });

    if (existente) return { companyId: existente, yaExistia: true };
    logger.info('Despacho demo creado', { uid, companyId: companyRef.id });
    // Best-effort: si falla, `sembrarLlamadasDemo` (idempotente) lo completa.
    try {
      await sembrarLlamadas(companyRef.id, new Date());
    } catch (e) {
      logger.error('No se pudieron sembrar las llamadas demo', { companyId: companyRef.id, error: (e as Error).message });
    }
    return { companyId: companyRef.id, yaExistia: false };
  },
);

/**
 * Escribe llamadas y agente de ejemplo con Admin SDK (las rules las reservan al backend).
 * Idempotente: ids deterministas y `create` solo de lo que falta, para no pisar lo que la
 * persona haya hecho después (descartar una llamada, enlazar un contacto).
 */
async function sembrarLlamadas(companyId: string, ahora: Date): Promise<number> {
  const db = admin.firestore();
  const docs = construirLlamadasDemo(companyId, ahora);
  const refs = docs.map((d) => db.doc(d.path));
  const existentes = await db.getAll(...refs);
  const batch = db.batch();
  let nuevas = 0;
  docs.forEach((d, i) => {
    if (existentes[i].exists) return;
    batch.create(refs[i], d.path.startsWith('llamadas/') ? { ...d.data, creadoEn: Timestamp.fromDate(d.data['creadoEn'] as Date) } : d.data);
    nuevas++;
  });
  if (nuevas > 0) await batch.commit();
  return nuevas;
}

/** Para despachos demo creados antes de la fase 3 (o si el sembrado del alta falló). */
export const sembrarLlamadasDemo = onCall<{ companyId?: string }, Promise<{ nuevas: number }>>(
  { enforceAppCheck: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    const companyId = request.data?.companyId;
    if (typeof companyId !== 'string' || !companyId) throw new HttpsError('invalid-argument', 'Falta companyId');

    const empresa = await admin.firestore().doc(`companies/${companyId}`).get();
    // Solo SU despacho demo y solo mientras esté vigente.
    if (!empresa.exists || !esEmpresaDemo(empresa.data())) throw new HttpsError('failed-precondition', 'No es un despacho de ejemplo');
    await assertCompanyAccess(uid, companyId, ['Admin']);
    if (demoExpirada(empresa.data(), new Date())) throw new HttpsError('failed-precondition', 'El despacho de ejemplo ya terminó');
    return { nuevas: await sembrarLlamadas(companyId, new Date()) };
  },
);
