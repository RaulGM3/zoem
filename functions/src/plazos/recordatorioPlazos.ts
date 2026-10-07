import * as admin from 'firebase-admin';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { notifyUsers, type NotifyDb, type NotifyMessaging } from '../notificaciones/notify';
import { hoyMadrid, seleccionarAvisos, textoAviso } from './avisos';
import { cargarDestinatariosCasos, type DbLectura } from './destinatarios';
import { componerDiasRojos, type CapaAnio, type DiaRojo } from './dominio/dias-rojos';
import { leerPlazo } from './onDiasRojosWritten';
import type { PlazoDoc } from './tipos';

/** Días rojos confirmados de una capa (todos los años cargados) como fecha -> día. */
async function cargarCapa(db: Firestore, cid: string, capaId: string): Promise<Map<string, DiaRojo>> {
  const snap = await db.collection(`companies/${cid}/calendariosJudiciales/${capaId}/anios`).get();
  const mapa = new Map<string, DiaRojo>();
  for (const d of snap.docs) {
    for (const [fecha, dia] of componerDiasRojos(d.data() as CapaAnio)) mapa.set(fecha, dia);
  }
  return mapa;
}

/**
 * Cada día a las 07:00 (Madrid) avisa de los plazos procesales a 5, 2 y 0 días hábiles del vencimiento
 * y marca como `vencido` los vigentes cuyo día de gracia ya pasó.
 * Consulta collection-group `eventos` (índice compuesto origen.tipo + origen.estadoPlazo en firestore.indexes.json).
 */
export const recordatorioPlazos = onSchedule(
  { schedule: '0 7 * * *', timeZone: 'Europe/Madrid', timeoutSeconds: 540, retryCount: 0 },
  async () => {
    const db = getFirestore();
    const hoy = hoyMadrid(new Date());
    const snap = await db
      .collectionGroup('eventos')
      .where('origen.tipo', '==', 'plazo_procesal')
      .where('origen.estadoPlazo', 'in', ['vigente', 'requiere_revision'])
      .get();

    const porEmpresa = new Map<string, PlazoDoc[]>();
    for (const d of snap.docs) {
      const cid = d.ref.parent.parent?.parent.parent?.id; // companies/{cid}/eventos/{id}
      const plazo = cid ? leerPlazo(cid, d.id, d.data()) : undefined;
      if (!plazo) continue;
      porEmpresa.set(plazo.cid, [...(porEmpresa.get(plazo.cid) ?? []), plazo]);
    }

    const notificar = (params: Parameters<typeof notifyUsers>[2]) =>
      notifyUsers(db as unknown as NotifyDb, admin.messaging() as unknown as NotifyMessaging, params);

    for (const [cid, plazos] of porEmpresa) {
      try {
        const capaIds = new Set(plazos.flatMap((p) => [p.origen.capas.ca, p.origen.capas.partido]).filter((c): c is string => !!c));
        const porCapa = new Map<string, ReadonlyMap<string, DiaRojo>>();
        for (const capaId of capaIds) porCapa.set(capaId, await cargarCapa(db, cid, capaId));

        const { avisos, vencidos } = seleccionarAvisos(plazos, hoy, porCapa);
        const destinatarios = avisos.length > 0 ? await cargarDestinatariosCasos(db as unknown as DbLectura, cid) : [];

        for (const { plazo, diasHabiles, marca } of avisos) {
          if (destinatarios.length > 0) {
            const { titulo, cuerpo } = textoAviso(plazo, diasHabiles);
            await notificar({ companyId: cid, userIds: destinatarios, tipo: 'plazo', titulo, cuerpo, route: `/casos/${plazo.origen.casoId}` });
          }
          await db.doc(`companies/${cid}/eventos/${plazo.id}`).update({ 'origen.ultimoAviso': marca });
        }
        for (const plazo of vencidos) {
          await db.doc(`companies/${cid}/eventos/${plazo.id}`).update({ 'origen.estadoPlazo': 'vencido' });
        }
      } catch (err) {
        logger.error('recordatorioPlazos: fallo procesando empresa', { cid, err });
      }
    }
    logger.info('recordatorioPlazos', { hoy, empresas: porEmpresa.size });
  },
);
