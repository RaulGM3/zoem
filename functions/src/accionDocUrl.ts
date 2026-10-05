import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { validarRutaEnvio, EXPIRA_ENLACE_MS, DIAS_VALIDEZ_ENLACE } from './accionDocPath';

interface AccionDocUrlData {
  companyId: string;
  /** Path de Storage: companies/{companyId}/acciones_envios/{registroId}.docx */
  path: string;
}

// URL firmada de lectura para el .docx que una acción adjunta al mensaje. Lo
// abre el DESTINATARIO (sin sesión), por eso no basta con la URL de descarga
// con token de Firebase ni con las Storage rules: se firma server-side tras
// comprobar que el caller es miembro activo del tenant dueño del archivo.
// Validez: máximo de V4 (7 días) — ver accionDocPath.ts.
export const accionDocUrl = onCall(
  { invoker: 'public', timeoutSeconds: 30 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    }

    const { companyId, path } = (request.data ?? {}) as AccionDocUrlData;
    if (!companyId || !path) {
      throw new HttpsError('invalid-argument', 'Faltan companyId o path');
    }
    if (!validarRutaEnvio(companyId, path)) {
      throw new HttpsError('invalid-argument', 'path fuera de acciones_envios del tenant');
    }

    const db = admin.firestore();
    const userSnap = await db.doc(`users/${uid}`).get();
    const isSuperUser = userSnap.get('isSuperUser') === true;
    const memberSnap = await db.doc(`companies/${companyId}/members/${uid}`).get();
    const isActive = memberSnap.exists && memberSnap.data()?.estado === 'activo';
    if (!isSuperUser && !isActive) {
      throw new HttpsError('permission-denied', 'No autorizado para esta empresa');
    }

    const file = admin.storage().bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError('not-found', 'Documento no encontrado');
    }

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + EXPIRA_ENLACE_MS,
    });

    logger.info('accion doc url served', { uid, companyId, path });
    return { url, expiresInDays: DIAS_VALIDEZ_ENLACE };
  },
);
