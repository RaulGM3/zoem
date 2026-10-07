import * as admin from 'firebase-admin';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { notifyUsers, type NotifyDb, type NotifyMessaging } from '../notificaciones/notify';
import { cargarDestinatariosCasos, type DbLectura } from './destinatarios';
import type { CapaAnio } from './dominio/dias-rojos';
import { procesarDiasRojos, type DepsDiasRojos } from './procesarDiasRojos';
import type { OrigenPlazoData, PlazoDoc } from './tipos';

const DB = '(default)';

export function leerPlazo(cid: string, id: string, data: FirebaseFirestore.DocumentData): PlazoDoc | undefined {
  const origen = data['origen'] as (OrigenPlazoData & { tipo?: string }) | undefined;
  if (origen?.tipo !== 'plazo_procesal') return undefined;
  return { id, cid, titulo: String(data['titulo'] ?? ''), origen };
}

function crearDeps(db: Firestore): DepsDiasRojos {
  return {
    plazosDeCapa: async (cid, capaId) => {
      const base = db
        .collection(`companies/${cid}/eventos`)
        .where('origen.tipo', '==', 'plazo_procesal')
        .where('origen.estadoPlazo', '==', 'vigente');
      // Dos consultas de igualdad (Firestore no admite OR entre campos distintos sin índice compuesto).
      const [porCa, porPartido] = await Promise.all([
        base.where('origen.capas.ca', '==', capaId).get(),
        base.where('origen.capas.partido', '==', capaId).get(),
      ]);
      const porId = new Map<string, PlazoDoc>();
      for (const d of [...porCa.docs, ...porPartido.docs]) {
        const plazo = leerPlazo(cid, d.id, d.data());
        if (plazo) porId.set(d.id, plazo);
      }
      return [...porId.values()];
    },
    cargarCapa: async (cid, capaId, anio) => {
      const snap = await db.doc(`companies/${cid}/calendariosJudiciales/${capaId}/anios/${anio}`).get();
      return snap.exists ? (snap.data() as CapaAnio) : undefined;
    },
    marcarRevision: async (cid, eventoId, revision) => {
      // Dot-paths: no se toca `fecha` ni `origen.aceptacion`.
      await db.doc(`companies/${cid}/eventos/${eventoId}`).update({
        'origen.estadoPlazo': 'requiere_revision',
        'origen.revision': revision,
      });
    },
    destinatarios: (cid) => cargarDestinatariosCasos(db as unknown as DbLectura, cid),
    notify: (params) =>
      notifyUsers(db as unknown as NotifyDb, admin.messaging() as unknown as NotifyMessaging, params),
    ahoraIso: () => new Date().toISOString(),
  };
}

/**
 * Cuando cambian los días rojos CONFIRMADOS de una capa/año, recalcula los plazos vigentes que la usan
 * y los marca como `requiere_revision` (nunca cambia la fecha en silencio) avisando al despacho.
 */
export const onDiasRojosWritten = onDocumentWritten(
  { document: 'companies/{cid}/calendariosJudiciales/{capaId}/anios/{anio}', database: DB },
  async (event) => {
    const anio = Number(event.params['anio']);
    if (!Number.isInteger(anio)) return;
    await procesarDiasRojos(crearDeps(getFirestore()), {
      cid: event.params['cid'],
      capaId: event.params['capaId'],
      anio,
      before: event.data?.before?.data() as CapaAnio | undefined,
      after: event.data?.after?.data() as CapaAnio | undefined,
    });
  },
);
