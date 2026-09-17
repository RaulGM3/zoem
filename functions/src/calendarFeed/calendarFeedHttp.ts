import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { buildIcs, type IcsEvento, type IcsHito } from './buildIcs';
import { hashToken, appBaseUrl } from './tokens';

const WINDOW_PAST_DAYS = 30;
const WINDOW_FUTURE_DAYS = 180;

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapEventoDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): IcsEvento {
  const d = doc.data();
  return {
    id: doc.id,
    titulo: d['titulo'] ?? '(sin título)',
    descripcion: d['descripcion'],
    link: d['link'],
    lugar: d['lugar'],
    fecha: d['fecha'],
    horaInicio: d['horaInicio'],
    horaFin: d['horaFin'],
    todoDia: d['todoDia'] === true,
    estado: d['estado'],
    recurrencia: d['recurrencia'] ?? 'ninguna',
    recurrenciaFin: d['recurrenciaFin'],
    recurrenciaOcurrencias: d['recurrenciaOcurrencias'],
  };
}

function mapHitoDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): IcsHito {
  const d = doc.data();
  return {
    id: doc.id,
    casoId: d['casoId'],
    casoTitulo: d['casoTitulo'],
    titulo: d['titulo'] ?? '(sin título)',
    fechaEstimada: d['fechaEstimada'],
    asignadoA: d['asignadoA'],
    asignadosA: d['asignadosA'],
    estado: d['estado'] ?? 'pendiente',
    horaAgenda: d['horaAgenda'],
    duracionAgenda: d['duracionAgenda'],
    registrosHoras: d['registrosHoras'],
  };
}

/** Fusiona dos snapshots de query por id de documento (sin duplicados). */
function mergeById(
  a: FirebaseFirestore.QuerySnapshot,
  b: FirebaseFirestore.QuerySnapshot,
): FirebaseFirestore.QueryDocumentSnapshot[] {
  const byId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const doc of a.docs) byId.set(doc.id, doc);
  for (const doc of b.docs) byId.set(doc.id, doc);
  return [...byId.values()];
}

/**
 * Feed ICS de suscripción de solo lectura (webcal). El token de la query
 * string `t` se hashea (SHA-256) y se busca en la collectionGroup
 * `calendarFeeds` por el campo `tokenHash` (indexado con scope
 * COLLECTION_GROUP en firestore.indexes.json — mismo patrón que
 * `members.userId`). El doc id ES el hash: usarlo directamente como filtro
 * de documentId() en una collectionGroup requeriría la ruta completa del
 * documento (que no conocemos sin cid), así que se consulta por el campo.
 *
 * Nunca se loguea el token en claro, solo su hash.
 */
export const calendarFeed = onRequest({ invoker: 'public' }, async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const token = typeof req.query['t'] === 'string' ? (req.query['t'] as string) : undefined;
  if (!token) {
    res.status(404).send('Not found');
    return;
  }

  const tokenHash = hashToken(token);
  const db = admin.firestore();

  const feedSnap = await db
    .collectionGroup('calendarFeeds')
    .where('tokenHash', '==', tokenHash)
    .limit(1)
    .get();

  if (feedSnap.empty) {
    logger.warn('calendar feed: token not found', { tokenHash });
    res.status(404).send('Not found');
    return;
  }

  const feedDoc = feedSnap.docs[0];
  const feedData = feedDoc.data();
  if (feedData['revoked'] === true) {
    logger.warn('calendar feed: token revoked', { tokenHash });
    res.status(404).send('Not found');
    return;
  }

  const uid = feedData['uid'] as string;
  // companies/{cid}/calendarFeeds/{hash} → el padre del padre es la empresa.
  const companyRef = feedDoc.ref.parent.parent;
  if (!companyRef) {
    res.status(404).send('Not found');
    return;
  }
  const companyId = companyRef.id;

  const memberSnap = await db.doc(`companies/${companyId}/members/${uid}`).get();
  const member = memberSnap.data();
  const userSnap = await db.doc(`users/${uid}`).get();
  const isSuperUser = userSnap.get('isSuperUser') === true;
  const isActiveMember = memberSnap.exists && member?.['estado'] === 'activo';
  if (!isSuperUser && !isActiveMember) {
    logger.warn('calendar feed: user no longer a member', { tokenHash, companyId });
    res.status(404).send('Not found');
    return;
  }

  const now = new Date();
  const windowStart = dateStr(new Date(now.getTime() - WINDOW_PAST_DAYS * 86_400_000));
  const windowEnd = dateStr(new Date(now.getTime() + WINDOW_FUTURE_DAYS * 86_400_000));

  const eventosCol = db.collection(`companies/${companyId}/eventos`);
  const [eventosEnVentana, eventosRecurrentes] = await Promise.all([
    eventosCol.where('fecha', '>=', windowStart).where('fecha', '<=', windowEnd).get(),
    // Las recurrentes se incluyen siempre: su propio RRULE/UNTIL acota las
    // ocurrencias futuras aunque la serie empezara antes de la ventana.
    eventosCol.where('recurrencia', '!=', 'ninguna').get(),
  ]);
  const eventos = mergeById(eventosEnVentana, eventosRecurrentes).map(mapEventoDoc);

  const hitosCol = db.collection(`companies/${companyId}/hitos`);
  const [hitosMultiAsignados, hitosLegacyAsignado] = await Promise.all([
    hitosCol.where('asignadosA', 'array-contains', uid).get(),
    hitosCol.where('asignadoA', '==', uid).get(),
  ]);
  const hitos = mergeById(hitosMultiAsignados, hitosLegacyAsignado).map(mapHitoDoc);

  const ics = buildIcs({ eventos, hitos, uid, appBaseUrl: appBaseUrl() }, now);

  logger.info('calendar feed served', { companyId, eventos: eventos.length, hitos: hitos.length });

  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Cache-Control', 'private, max-age=300');
  res.set('Content-Disposition', 'inline; filename="zoem.ics"');
  res.status(200).send(ics);
});
