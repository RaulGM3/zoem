import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import {
  handleCasoWritten,
  handleContactoWritten,
  handleEventoWritten,
  handleHitoWritten,
  handleLlamadaCreated,
  type CasoData,
  type ContactoData,
  type EventoData,
  type HitoData,
  type LlamadaData,
  type TriggerDeps,
} from './handlers';
import { contarUso } from '../uso/aplicar';
import { notifyUsers, type NotifyDb, type NotifyMessaging } from './notify';

const DB = '(default)';

function buildDeps(): TriggerDeps {
  const db = getFirestore();

  const members = async (companyId: string, roles?: string[]): Promise<string[]> => {
    const snap = await db
      .collection(`companies/${companyId}/members`)
      .where('estado', '==', 'activo')
      .get();
    return snap.docs
      .filter((d) => !roles || roles.includes(d.get('role') as string))
      .map((d) => d.id);
  };

  return {
    notify: (params) =>
      notifyUsers(
        db as unknown as NotifyDb,
        admin.messaging() as unknown as NotifyMessaging,
        params,
      ),
    companyIdForAgent: async (agentId) => {
      const snap = await db.doc(`agentMappings/${agentId}`).get();
      return snap.exists ? (snap.get('companyId') as string | undefined) : undefined;
    },
    managerIds: (cid) => members(cid, ['Admin', 'Gestor']),
    activeMemberIds: (cid) => members(cid),
    isMember: async (cid, uid) => (await db.doc(`companies/${cid}/members/${uid}`).get()).exists,
  };
}

export const onLlamadaCreated = onDocumentCreated(
  { document: 'llamadas/{id}', database: DB },
  async (event) => {
    const data = event.data?.data() as LlamadaData | undefined;
    if (!data) return;
    await handleLlamadaCreated(buildDeps(), data);
  },
);

export const onCasoWritten = onDocumentWritten(
  { document: 'companies/{cid}/casos/{id}', database: DB },
  async (event) => {
    await Promise.all([
      handleCasoWritten(buildDeps(), {
        cid: event.params['cid'],
        id: event.params['id'],
        before: event.data?.before?.data() as CasoData | undefined,
        after: event.data?.after?.data() as CasoData | undefined,
      }),
      // Contador de uso (cupo de casos activos): comparte trigger para no duplicar la ruta.
      contarUso('caso', event.params['cid'], event.params['id'], event.data?.before?.data(), event.data?.after?.data()),
    ]);
  },
);

export const onContactoWritten = onDocumentWritten(
  { document: 'companies/{cid}/contactos/{id}', database: DB },
  async (event) => {
    await Promise.all([
      handleContactoWritten(buildDeps(), {
        cid: event.params['cid'],
        id: event.params['id'],
        before: event.data?.before?.data() as ContactoData | undefined,
        after: event.data?.after?.data() as ContactoData | undefined,
      }),
      contarUso('contacto', event.params['cid'], event.params['id'], event.data?.before?.data(), event.data?.after?.data()),
    ]);
  },
);

export const onEventoWritten = onDocumentWritten(
  { document: 'companies/{cid}/eventos/{id}', database: DB },
  async (event) => {
    await handleEventoWritten(buildDeps(), {
      cid: event.params['cid'],
      before: event.data?.before?.data() as EventoData | undefined,
      after: event.data?.after?.data() as EventoData | undefined,
    });
  },
);

export const onHitoWritten = onDocumentWritten(
  { document: 'companies/{cid}/hitos/{id}', database: DB },
  async (event) => {
    await handleHitoWritten(buildDeps(), {
      cid: event.params['cid'],
      before: event.data?.before?.data() as HitoData | undefined,
      after: event.data?.after?.data() as HitoData | undefined,
    });
  },
);
