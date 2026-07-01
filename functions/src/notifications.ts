import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

interface SendPushPayload {
  userId: string;
  title: string;
  body: string;
  /** Ruta a abrir al hacer tap en la notificación (ej: "/casos/abc123") */
  route?: string;
  /** Datos arbitrarios adicionales */
  data?: Record<string, string>;
}

/**
 * Envía una push notification a todos los device tokens de un usuario.
 * Se encarga de limpiar tokens inválidos de Firestore automáticamente.
 *
 * Ejemplo de invocación desde cliente Angular:
 *   httpsCallable(functions, 'sendPushNotification')({ userId, title, body, route })
 */
export const sendPushNotification = onCall<SendPushPayload>(
  { region: 'europe-west1' },
  async (request) => {
    // Solo usuarios autenticados pueden enviar notificaciones.
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Se requiere autenticación.');
    }

    const { userId, title, body, route, data = {} } = request.data;

    if (!userId || !title || !body) {
      throw new HttpsError('invalid-argument', 'userId, title y body son requeridos.');
    }

    const tokensSnap = await admin
      .firestore()
      .collection(`users/${userId}/deviceTokens`)
      .get();

    if (tokensSnap.empty) {
      logger.info('No hay device tokens para el usuario', { userId });
      return { sent: 0 };
    }

    const tokens = tokensSnap.docs.map((d) => d.id);

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data: { ...data, ...(route ? { route } : {}) },
      apns: {
        payload: { aps: { badge: 1, sound: 'default' } },
      },
      android: {
        priority: 'high',
        notification: { sound: 'default' },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info('Push enviada', { userId, sent: response.successCount, failed: response.failureCount });

    // Limpiar tokens inválidos para no acumular basura en Firestore.
    const staleTokenDeletions = response.responses
      .map((r, i) => ({ result: r, token: tokens[i] }))
      .filter(({ result }) => !result.success)
      .map(({ token }) =>
        admin.firestore().doc(`users/${userId}/deviceTokens/${token}`).delete(),
      );

    if (staleTokenDeletions.length > 0) {
      await Promise.all(staleTokenDeletions);
      logger.info('Tokens inválidos eliminados', { count: staleTokenDeletions.length });
    }

    return { sent: response.successCount, failed: response.failureCount };
  },
);
