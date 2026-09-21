import type { ContactStatus } from '../../interfaces/contact.interface';
import type { CreateEventoData, Evento, EventoOrigenSeguimiento } from '../../interfaces/evento.interface';
import type { FirmRole } from '../../interfaces/member';

/** Compromiso que el despacho adquiere para que el contacto avance de fase. */
export interface SeguimientoDraft {
  /** Qué hay que entregar. */
  entregable: string;
  /** Hasta cuándo, en formato YYYY-MM-DD. */
  fechaLimite: string;
  /** Miembro que responde por el compromiso. */
  responsableId: string;
}

/**
 * Qué se suele entregar al pasar a cada estado y en cuántos días.
 * Sólo prellena el formulario: el usuario puede cambiarlo o omitirlo.
 * Los estados terminales (inactivo, cerrado_finalizado, activo) no piden nada.
 */
export const SEGUIMIENTO_SUGERENCIAS: Partial<
  Record<ContactStatus, { entregable: string; diasPlazo: number }>
> = {
  potencial: { entregable: 'Contactar y agendar primera reunión', diasPlazo: 2 },
  pendiente_presupuesto: { entregable: 'Enviar propuesta de honorarios', diasPlazo: 3 },
  pendiente_firma_hoja_encargo: { entregable: 'Enviar hoja de encargo para firma', diasPlazo: 5 },
  pendiente_pago: { entregable: 'Emitir y enviar la factura', diasPlazo: 7 },
  integracion_plantillas: { entregable: 'Generar la documentación del caso', diasPlazo: 5 },
};

/**
 * Suma días a una fecha YYYY-MM-DD.
 * Opera en UTC a propósito: construir un Date local y serializar con toISOString()
 * desplaza el día en husos por delante de UTC (mismo motivo documentado en dashboard.ts).
 */
export function fechaLimiteSugerida(hoy: string, diasPlazo: number): string {
  const [y, m, d] = hoy.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + diasPlazo)).toISOString().slice(0, 10);
}

/** Un seguimiento es un Evento nacido de un cambio de estado de contacto. */
export function esSeguimiento(
  evento: Evento,
): evento is Evento & { origen: EventoOrigenSeguimiento } {
  return evento.origen?.tipo === 'seguimiento_contacto';
}

/** Un compromiso ya cerrado nunca vence, por muy atrasada que esté su fecha. */
export function esVencido(evento: Evento, hoy: string): boolean {
  if (evento.estado === 'completado' || evento.estado === 'cancelado') return false;
  return evento.fecha < hoy;
}

/**
 * Control de acceso client-side, coherente con el resto del proyecto:
 * `firestore.rules` mantiene el enforcement grueso (ver su cabecera, L220-232).
 * Pueden gestionar un seguimiento el superusuario, Admin, Gestor y el responsable asignado.
 */
export function puedeGestionarSeguimiento(
  evento: Evento,
  userId: string | null,
  role: FirmRole | null,
  isSuperUser: boolean,
): boolean {
  if (isSuperUser) return true;
  if (role === 'Viewer' || !role) return false;
  if (role === 'Admin' || role === 'Gestor') return true;
  return !!userId && evento.responsableId === userId;
}

/** Traduce el compromiso a un Evento de calendario listo para persistir. */
export function seguimientoToEvento(
  draft: SeguimientoDraft,
  origen: Omit<EventoOrigenSeguimiento, 'tipo'>,
): CreateEventoData {
  return {
    titulo: `${draft.entregable} — ${origen.contactoNombre}`,
    descripcion: `Seguimiento del contacto ${origen.contactoNombre}.`,
    fecha: draft.fechaLimite,
    todoDia: true,
    estado: 'confirmado',
    recurrencia: 'ninguna',
    prioridad: 'alta',
    color: 'naranja',
    invitados: [draft.responsableId],
    responsableId: draft.responsableId,
    entregable: draft.entregable,
    origen: { tipo: 'seguimiento_contacto', ...origen },
  };
}
