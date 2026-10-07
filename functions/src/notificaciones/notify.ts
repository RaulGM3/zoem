import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

export type TipoNotificacion = 'llamadas' | 'casos' | 'contactos' | 'eventos' | 'hitos' | 'plazo';

export interface NotifyParams {
  companyId: string;
  userIds: string[];
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  route: string;
}

/** Forma mínima de Firestore que necesitamos (facilita los fakes en tests). */
export interface NotifyDb {
  doc(path: string): {
    get(): Promise<{ exists: boolean; data(): unknown }>;
    delete(): Promise<unknown>;
  };
  collection(path: string): {
    add(data: Record<string, unknown>): Promise<unknown>;
    get(): Promise<{ docs: ReadonlyArray<{ id: string }> }>;
  };
}

export interface NotifyMessaging {
  sendEachForMulticast(message: {
    tokens: string[];
    notification: { title: string; body: string };
    data: Record<string, string>;
    apns?: unknown;
    android?: unknown;
  }): Promise<{ responses: ReadonlyArray<{ success: boolean; error?: { code?: string } }> }>;
}

interface UserPrefsDoc {
  notificationPrefs?: Record<string, boolean | undefined>;
}

const STALE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

/**
 * Notifica a un conjunto de usuarios: guarda la notificación in-app y envía
 * push FCM a sus dispositivos. Respeta `users/{uid}.notificationPrefs`
 * (por defecto todo activo; `prefs[tipo] === false` omite al usuario y
 * `prefs.push === false` omite solo el push).
 */
export async function notifyUsers(
  db: NotifyDb,
  messaging: NotifyMessaging,
  params: NotifyParams,
): Promise<void> {
  const { companyId, tipo, titulo, cuerpo, route } = params;
  const userIds = [...new Set(params.userIds)];

  for (const userId of userIds) {
    try {
      const userSnap = await db.doc(`users/${userId}`).get();
      const prefs = (userSnap.exists ? (userSnap.data() as UserPrefsDoc | undefined) : undefined)
        ?.notificationPrefs;
      if (prefs?.[tipo] === false) continue;

      await db.collection(`companies/${companyId}/notificaciones`).add({
        userId,
        tipo,
        titulo,
        cuerpo,
        route,
        leida: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      if (prefs?.['push'] === false) continue;
      await sendPush(db, messaging, userId, titulo, cuerpo, route);
    } catch (err) {
      logger.error('notifyUsers: fallo notificando al usuario', { userId, tipo, err });
    }
  }
}

async function sendPush(
  db: NotifyDb,
  messaging: NotifyMessaging,
  userId: string,
  titulo: string,
  cuerpo: string,
  route: string,
): Promise<void> {
  const tokensSnap = await db.collection(`users/${userId}/deviceTokens`).get();
  const tokens = tokensSnap.docs.map((d) => d.id);
  if (tokens.length === 0) return;

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: titulo, body: cuerpo },
    data: { route },
    apns: { payload: { aps: { badge: 1, sound: 'default' } } },
    android: { priority: 'high', notification: { sound: 'default' } },
  });

  const stale = response.responses
    .map((r, i) => ({ r, token: tokens[i] }))
    .filter(({ r }) => !r.success && STALE_TOKEN_CODES.has(r.error?.code ?? ''));

  await Promise.all(
    stale.map(({ token }) => db.doc(`users/${userId}/deviceTokens/${token}`).delete()),
  );
  if (stale.length > 0) {
    logger.info('Tokens inválidos eliminados', { userId, count: stale.length });
  }
}
