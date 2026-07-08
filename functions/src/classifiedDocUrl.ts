import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

interface GetClassifiedDocUrlData {
  companyId: string;
  /** Path Firestore del doc del archivo (ej. companies/c1/casos/k1/doc_files/f1). */
  docPath: string;
  action?: 'view' | 'download';
  /** Descargar una versión concreta del historial (por defecto la actual). */
  version?: number;
}

// Sirve URLs firmadas de corta vida para documentos CLASIFICADOS y deja el
// evento de auditoría escrito con el Admin SDK — el único rastro de vistas que
// un cliente malicioso no puede evitar ni falsificar. Los documentos no
// clasificados usan su downloadUrl normal con logging best-effort del cliente.
export const getClassifiedDocUrl = onCall(
  { invoker: 'public', timeoutSeconds: 30 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    }

    const { companyId, docPath, action = 'view', version } =
      (request.data ?? {}) as GetClassifiedDocUrlData;
    if (!companyId || !docPath) {
      throw new HttpsError('invalid-argument', 'Faltan companyId o docPath');
    }
    // El doc debe pertenecer al tenant del caller o ser un top-level conocido
    // (contact_files) — nunca un path arbitrario de otra empresa.
    const isCompanyPath = docPath.startsWith(`companies/${companyId}/`);
    const isContactFile = /^contact_files\/[^/]+$/.test(docPath);
    if (!isCompanyPath && !isContactFile) {
      throw new HttpsError('invalid-argument', 'docPath fuera del tenant');
    }

    const db = admin.firestore();

    // Membresía activa (cualquier rol: la allowlist decide el acceso fino).
    const userSnap = await db.doc(`users/${uid}`).get();
    const isSuperUser = userSnap.get('isSuperUser') === true;
    const memberSnap = await db.doc(`companies/${companyId}/members/${uid}`).get();
    const member = memberSnap.data();
    const isActive = memberSnap.exists && member?.estado === 'activo';
    if (!isSuperUser && !isActive) {
      throw new HttpsError('permission-denied', 'No autorizado para esta empresa');
    }

    const docSnap = await db.doc(docPath).get();
    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'Documento no encontrado');
    }
    const data = docSnap.data() ?? {};
    if (isContactFile && data.companyId !== companyId) {
      throw new HttpsError('permission-denied', 'Documento de otra empresa');
    }
    if (data.deleted === true && !isSuperUser && member?.role !== 'Admin') {
      throw new HttpsError('not-found', 'Documento no disponible');
    }

    // Acceso fino: Admin/superuser o allowlist.
    const isAdmin = isSuperUser || member?.role === 'Admin';
    const allowed = (data.allowedUserIds as string[] | undefined) ?? [];
    if (data.clasificado === true && !isAdmin && !allowed.includes(uid)) {
      throw new HttpsError('permission-denied', 'No tienes acceso a este documento');
    }

    // Versión pedida (o la actual).
    let storagePath = data.storagePath as string | undefined;
    let fileName = data.name as string | undefined;
    if (version !== undefined) {
      const versions = (data.versions as { version: number; storagePath: string; name: string }[]) ?? [];
      const entry = versions.find(v => v.version === version);
      if (!entry) throw new HttpsError('not-found', 'Versión no encontrada');
      storagePath = entry.storagePath;
      fileName = entry.name;
    }
    if (!storagePath) {
      throw new HttpsError('failed-precondition', 'El documento no tiene archivo');
    }

    // Auditoría server-side ANTES de entregar la URL: no falsificable.
    await docSnap.ref.collection('doc_audit').add({
      companyId,
      action,
      userId: uid,
      userNombre: member?.nombre ?? userSnap.get('displayName') ?? userSnap.get('email') ?? '',
      ...(version !== undefined ? { version } : {}),
      detail: `${fileName ?? ''} (URL firmada)`,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const [signedUrl] = await admin
      .storage()
      .bucket()
      .file(storagePath)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 5 * 60 * 1000, // 5 minutos
      });

    logger.info('classified doc url served', { uid, companyId, docPath, action });
    return { url: signedUrl, expiresInSeconds: 300 };
  },
);
