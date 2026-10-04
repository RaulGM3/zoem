/** Ids que aparecen en `after` y no en `before`, sin el actor. */
export function destinatariosAsignacion(
  before: string[] | undefined,
  after: string[] | undefined,
  actor?: string,
): string[] {
  const previos = new Set(before ?? []);
  const nuevos = (after ?? []).filter((id) => !!id && !previos.has(id) && id !== actor);
  return [...new Set(nuevos)];
}

interface HitoAsignaciones {
  asignadosA?: string[];
  asignadoA?: string;
}

/** Normaliza asignados de un hito: `asignadosA` y, si está vacío, el legacy `asignadoA`. */
export function asignadosHito(hito: HitoAsignaciones | undefined): string[] {
  if (hito?.asignadosA && hito.asignadosA.length > 0) return hito.asignadosA;
  return hito?.asignadoA ? [hito.asignadoA] : [];
}

interface EventoInvitados {
  invitados?: string[] | 'todos';
  responsableId?: string;
  creadoPor?: string;
}

/** Expande `'todos'` a los uids de miembros activos. */
export function invitadosEvento(
  evento: Pick<EventoInvitados, 'invitados'> | undefined,
  miembrosActivos: string[],
): string[] {
  const inv = evento?.invitados;
  if (inv === 'todos') return miembrosActivos;
  return Array.isArray(inv) ? inv : [];
}

/** Invitados nuevos + responsable nuevo, sin el actor ni el creador del evento. */
export function destinatariosEvento(
  before: EventoInvitados | undefined,
  after: EventoInvitados,
  miembrosActivos: string[],
  actor: string | undefined,
): string[] {
  const nuevosInvitados = destinatariosAsignacion(
    before ? invitadosEvento(before, miembrosActivos) : undefined,
    invitadosEvento(after, miembrosActivos),
    actor,
  );
  const responsable = nuevoValor(before?.responsableId, after.responsableId);
  const todos = responsable ? [...nuevosInvitados, responsable] : nuevosInvitados;
  return [...new Set(todos)].filter((id) => id !== actor && id !== after.creadoPor);
}

/** Quién hizo el cambio: `updatedBy` en updates, `createdBy`/`creadoPor` en creaciones. */
export function actorDe(
  data: { updatedBy?: string; createdBy?: string; creadoPor?: string } | undefined,
  esUpdate: boolean,
): string | undefined {
  if (!data) return undefined;
  if (esUpdate) return data.updatedBy;
  return data.createdBy ?? data.creadoPor;
}

/** Devuelve `after` solo si es un valor no vacío distinto de `before`. */
export function nuevoValor(before: string | undefined, after: string | undefined): string | undefined {
  return after && after !== before ? after : undefined;
}
