import * as logger from 'firebase-functions/logger';
import type { NotifyParams } from './notify';
import {
  actorDe,
  asignadosHito,
  destinatariosAsignacion,
  destinatariosEvento,
  nuevoValor,
} from './asignacion';

/** Dependencias externas de los handlers (inyectadas para poder testearlos sin Firestore). */
export interface TriggerDeps {
  notify(params: NotifyParams): Promise<void>;
  companyIdForAgent(agentId: string): Promise<string | undefined>;
  /** uids de miembros activos con rol Admin o Gestor. */
  managerIds(companyId: string): Promise<string[]>;
  /** uids de todos los miembros activos. */
  activeMemberIds(companyId: string): Promise<string[]>;
  isMember(companyId: string, uid: string): Promise<boolean>;
  /** uids de miembros activos con permiso de lectura sobre el módulo Casos. */
  casosViewerIds(companyId: string): Promise<string[]>;
}

interface Actor {
  updatedBy?: string;
  createdBy?: string;
  creadoPor?: string;
}

interface Cambio<T> {
  cid: string;
  /** undefined en creaciones. */
  before: T | undefined;
  /** undefined en borrados. */
  after: T | undefined;
}

// ─── Llamadas ────────────────────────────────────────────────────────────────

export interface LlamadaData {
  agentId: string;
  datosCapturados?: { nombreCliente?: string; nivelUrgencia?: string };
}

export async function handleLlamadaCreated(deps: TriggerDeps, llamada: LlamadaData): Promise<void> {
  const companyId = await deps.companyIdForAgent(llamada.agentId);
  if (!companyId) {
    logger.warn('Llamada sin agentMapping: no se notifica', { agentId: llamada.agentId });
    return;
  }
  const userIds = await deps.managerIds(companyId);
  if (userIds.length === 0) return;

  const nombre = llamada.datosCapturados?.nombreCliente ?? 'Desconocido';
  const urgencia = llamada.datosCapturados?.nivelUrgencia;
  await deps.notify({
    companyId,
    userIds,
    tipo: 'llamadas',
    titulo: 'Nueva llamada',
    cuerpo: urgencia ? `${nombre} · urgencia ${urgencia}` : nombre,
    route: '/llamadas',
  });
}

// ─── Casos ───────────────────────────────────────────────────────────────────

export interface CasoData extends Actor {
  titulo?: string;
  encargadoId?: string;
}

export async function handleCasoWritten(
  deps: TriggerDeps,
  c: Cambio<CasoData> & { id: string },
): Promise<void> {
  if (!c.after) return;
  const actor = actorDe(c.after, !!c.before);
  const encargado = nuevoValor(c.before?.encargadoId, c.after.encargadoId);
  if (!encargado || encargado === actor) return;

  await deps.notify({
    companyId: c.cid,
    userIds: [encargado],
    tipo: 'casos',
    titulo: 'Te han asignado un caso',
    cuerpo: c.after.titulo ?? '',
    route: `/casos/${c.id}`,
  });
}

// ─── Contactos ───────────────────────────────────────────────────────────────

export interface ContactoData extends Actor {
  type?: string;
  nombre?: string;
  apellidos?: string;
  razonSocial?: string;
  assignedTo?: string;
}

function nombreContacto(c: ContactoData): string {
  if (c.type === 'persona_juridica') return c.razonSocial ?? '';
  return [c.nombre, c.apellidos].filter(Boolean).join(' ');
}

export async function handleContactoWritten(
  deps: TriggerDeps,
  c: Cambio<ContactoData> & { id: string },
): Promise<void> {
  if (!c.after) return;
  const actor = actorDe(c.after, !!c.before);
  const asignado = nuevoValor(c.before?.assignedTo, c.after.assignedTo);
  if (!asignado || asignado === actor) return;

  // assignedTo puede ser un nombre (import CSV): solo notificamos si es un uid de miembro.
  if (!(await deps.isMember(c.cid, asignado))) {
    logger.warn('Contacto: assignedTo no es un miembro, se omite la notificación', {
      cid: c.cid,
      contactoId: c.id,
    });
    return;
  }

  await deps.notify({
    companyId: c.cid,
    userIds: [asignado],
    tipo: 'contactos',
    titulo: 'Te han asignado un contacto',
    cuerpo: nombreContacto(c.after),
    route: `/contactos/${c.id}`,
  });
}

// ─── Eventos ─────────────────────────────────────────────────────────────────

export interface EventoData extends Actor {
  titulo?: string;
  invitados?: string[] | 'todos';
  responsableId?: string;
  origen?: { tipo?: string; casoId?: string };
}

export async function handleEventoWritten(
  deps: TriggerDeps,
  c: Cambio<EventoData>,
): Promise<void> {
  if (!c.after) return;
  const necesitaMiembros = c.before?.invitados === 'todos' || c.after.invitados === 'todos';
  const miembros = necesitaMiembros ? await deps.activeMemberIds(c.cid) : [];

  let userIds = destinatariosEvento(c.before, c.after, miembros, actorDe(c.after, !!c.before));
  if (userIds.length === 0) return;

  // Un plazo procesal revela el caso: solo se avisa a quien puede ver Casos.
  const origen = c.after.origen;
  if (origen?.tipo === 'plazo_procesal') {
    const pueden = new Set(await deps.casosViewerIds(c.cid));
    userIds = userIds.filter((id) => pueden.has(id));
    if (userIds.length === 0) return;
    await deps.notify({
      companyId: c.cid,
      userIds,
      tipo: 'plazo',
      titulo: 'Nuevo plazo procesal',
      cuerpo: c.after.titulo ?? '',
      route: `/casos/${origen.casoId}`,
    });
    return;
  }

  await deps.notify({
    companyId: c.cid,
    userIds,
    tipo: 'eventos',
    titulo: 'Nuevo evento',
    cuerpo: c.after.titulo ?? '',
    route: '/calendario',
  });
}

// ─── Hitos ───────────────────────────────────────────────────────────────────

export interface HitoData extends Actor {
  titulo?: string;
  casoId?: string;
  asignadosA?: string[];
  asignadoA?: string;
}

export async function handleHitoWritten(deps: TriggerDeps, c: Cambio<HitoData>): Promise<void> {
  if (!c.after) return;
  const userIds = destinatariosAsignacion(
    c.before ? asignadosHito(c.before) : undefined,
    asignadosHito(c.after),
    actorDe(c.after, !!c.before),
  );
  if (userIds.length === 0) return;

  await deps.notify({
    companyId: c.cid,
    userIds,
    tipo: 'hitos',
    titulo: 'Te han asignado un hito',
    cuerpo: c.after.titulo ?? '',
    route: `/casos/${c.after.casoId ?? ''}`,
  });
}
