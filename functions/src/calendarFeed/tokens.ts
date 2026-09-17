import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { assertCompanyAccess } from '../lib/assertCompanyAccess';

// Cualquier miembro activo (incluso Viewer) puede suscribirse a su propia
// agenda: la matriz fina 'Calendario'/'ver' vive en Firestore (no en custom
// claims) y no es verificable acá sin portar esa lógica — ver la limitación
// ya documentada en firestore.rules para docTemplates. Gateamos por
// membresía activa, que es lo que SÍ podemos verificar server-side.
const ANY_ACTIVE_ROLE = ['Admin', 'Gestor', 'Usuario', 'Viewer'] as const;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function feedsCollection(companyId: string) {
  return admin.firestore().collection(`companies/${companyId}/calendarFeeds`);
}

function appBaseUrl(): string {
  const projectId = process.env.GCLOUD_PROJECT ?? admin.app().options.projectId;
  return `https://${projectId}.web.app`;
}

function functionBaseUrl(): string {
  const projectId = process.env.GCLOUD_PROJECT ?? admin.app().options.projectId;
  return `https://europe-west1-${projectId}.cloudfunctions.net/calendarFeed`;
}

interface CreateTokenRequest {
  companyId: string;
}

interface CreateTokenResponse {
  /** URL https lista para "Copiar" o para pegar en la mayoría de clientes. */
  feedUrl: string;
  /** Misma URL con esquema webcal:// — algunos clientes (Apple Calendar) lo prefieren. */
  webcalUrl: string;
}

/**
 * Crea un token de suscripción al feed ICS del calendario. Solo se persiste
 * el hash SHA-256 (nunca el token en claro); el token completo solo existe
 * en la respuesta de esta llamada — el cliente debe guardarlo/copiarlo ahí.
 * Revoca cualquier token previo del mismo usuario en esa empresa.
 */
export const createCalendarFeedToken = onCall<CreateTokenRequest, Promise<CreateTokenResponse>>(
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión');

    const { companyId } = request.data ?? {};
    if (!companyId) throw new HttpsError('invalid-argument', 'Falta companyId');

    await assertCompanyAccess(uid, companyId, ANY_ACTIVE_ROLE);

    const db = admin.firestore();
    const col = feedsCollection(companyId);

    const previous = await col.where('uid', '==', uid).where('revoked', '==', false).get();

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);

    const batch = db.batch();
    previous.forEach((docSnap) => {
      batch.update(docSnap.ref, { revoked: true, revokedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    batch.set(col.doc(tokenHash), {
      uid,
      tokenHash,
      revoked: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    // Nunca logueamos el token en claro — solo metadatos.
    logger.info('calendar feed token created', { uid, companyId, revokedPrevious: previous.size });

    const feedUrl = `${functionBaseUrl()}?t=${token}`;
    return {
      feedUrl,
      webcalUrl: feedUrl.replace(/^https:\/\//, 'webcal://'),
    };
  },
);

interface RevokeTokenRequest {
  companyId: string;
}

interface RevokeTokenResponse {
  revoked: number;
}

/** Revoca todos los tokens de feed activos del usuario para una empresa. */
export const revokeCalendarFeedToken = onCall<RevokeTokenRequest, Promise<RevokeTokenResponse>>(
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión');

    const { companyId } = request.data ?? {};
    if (!companyId) throw new HttpsError('invalid-argument', 'Falta companyId');

    await assertCompanyAccess(uid, companyId, ANY_ACTIVE_ROLE);

    const db = admin.firestore();
    const col = feedsCollection(companyId);
    const active = await col.where('uid', '==', uid).where('revoked', '==', false).get();

    if (active.empty) return { revoked: 0 };

    const batch = db.batch();
    active.forEach((docSnap) => {
      batch.update(docSnap.ref, { revoked: true, revokedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();

    logger.info('calendar feed tokens revoked', { uid, companyId, count: active.size });
    return { revoked: active.size };
  },
);

export { appBaseUrl };
