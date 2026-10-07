import { Timestamp } from '@angular/fire/firestore';
import type { Anotacion } from './caso.interface';
import type { ContactStatus } from './contact.interface';
import type { Jurisdiccion } from '../core/plazos/calendario-judicial';
import type { UnidadPlazo } from '../core/plazos/computo-plazo';

export type EventoPrioridad = 'alta' | 'media' | 'baja' | 'ninguna';
export type EventoRecurrencia = 'ninguna' | 'diaria' | 'semanal' | 'mensual' | 'anual';
export type EventoColor = 'rojo' | 'naranja' | 'amarillo' | 'verde' | 'azul' | 'violeta' | 'gris';
export type EventoEstado = 'confirmado' | 'tentativo' | 'en_progreso' | 'completado' | 'cancelado';

/** Fuente de verdad de presentación para el estado de un Evento (estilo Google Calendar). */
export const EVENTO_ESTADOS: readonly EventoEstado[] = [
  'confirmado', 'tentativo', 'en_progreso', 'completado', 'cancelado',
];

export const EVENTO_ESTADO_LABEL: Record<EventoEstado, string> = {
  confirmado: 'Confirmado',
  tentativo: 'Tentativo',
  en_progreso: 'En proceso',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

/** Dark-mode-aware: clases definidas en styles.css (color-mix sobre tokens semánticos). */
export const EVENTO_ESTADO_BADGE_CLASS: Record<EventoEstado, string> = {
  confirmado: 'badge-success',
  tentativo: 'badge-warning',
  en_progreso: 'badge-brand',
  completado: 'badge-success',
  cancelado: 'badge-muted',
};

export const EVENTO_COLORS: Record<EventoColor, { label: string; bg: string; text: string; dot: string; border: string }> = {
  rojo:     { label: 'Rojo',     bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    border: 'border-l-red-500' },
  naranja:  { label: 'Naranja',  bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-l-orange-500' },
  amarillo: { label: 'Amarillo', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400', border: 'border-l-yellow-400' },
  verde:    { label: 'Verde',    bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500',  border: 'border-l-green-500' },
  azul:     { label: 'Azul',     bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',   border: 'border-l-blue-500' },
  violeta:  { label: 'Violeta',  bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500', border: 'border-l-violet-500' },
  gris:     { label: 'Gris',     bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400',  border: 'border-l-slate-400' },
};

export const PRIORIDAD_CONFIG: Record<EventoPrioridad, { label: string; bg: string; text: string }> = {
  alta:    { label: 'Alta',    bg: 'bg-red-100',    text: 'text-red-700' },
  media:   { label: 'Media',   bg: 'bg-amber-100',  text: 'text-amber-700' },
  baja:    { label: 'Baja',    bg: 'bg-blue-100',   text: 'text-blue-700' },
  ninguna: { label: 'Ninguna', bg: 'bg-slate-100',  text: 'text-slate-500' },
};

export const RECURRENCIA_LABELS: Record<EventoRecurrencia, string> = {
  ninguna: 'No se repite',
  diaria:  'Cada día',
  semanal: 'Cada semana',
  mensual: 'Cada mes',
  anual:   'Cada año',
};

export type RecurrenciaFinTipo = 'fecha' | 'ocurrencias';

/**
 * Trazabilidad de un evento nacido de un cambio de estado de contacto.
 * Un "seguimiento" es un Evento con este origen: así el calendario, el feed ICS
 * y el dashboard lo pintan sin conocer el concepto.
 */
export interface EventoOrigenSeguimiento {
  tipo: 'seguimiento_contacto';
  contactoId: string;
  /** Denormalizado para pintar el seguimiento sin cargar el contacto. */
  contactoNombre: string;
  statusOrigen: ContactStatus;
  statusDestino: ContactStatus;
}

export type EstadoPlazo = 'vigente' | 'requiere_revision' | 'cumplido' | 'vencido';

/**
 * Trazabilidad de un evento que es un plazo procesal aceptado por el usuario.
 * Guarda la entrada, las capas de calendario usadas y los días inhábiles aceptados:
 * nada cambia en silencio después de aceptado (ver `revision`).
 */
export interface OrigenPlazoProcesal {
  tipo: 'plazo_procesal';
  casoId: string;
  /** Ids de capa usados en el cálculo: comunidad autónoma y, si existía, partido judicial. */
  capas: { ca: string; partido?: string };
  entrada: {
    fechaNotificacion: string;
    cantidad: number;
    unidad: UnidadPlazo;
    jurisdiccion: Jurisdiccion;
    urgente?: boolean;
    tipoPlazoId?: string;
  };
  aceptacion: {
    diasInhabiles: { fecha: string; motivo: string }[];
    excluidosPorUsuario: string[];
    aceptadoPor: string;
    /** ISO datetime. */
    aceptadoAt: string;
    vencimiento: string;
  };
  estadoPlazo: EstadoPlazo;
  /** Presente si un cambio posterior de días rojos altera el vencimiento (requiere revisión humana). */
  revision?: { vencimientoNuevo: string; seAdelanta: boolean; detectadoAt: string };
  documentoId?: string;
  /** Último recordatorio enviado por la Cloud Function, 'YYYY-MM-DD:N' (evita duplicados en el mismo día). */
  ultimoAviso?: string;
}

export type EventoOrigen = EventoOrigenSeguimiento | OrigenPlazoProcesal;

export interface Evento {
  id: string;
  companyId: string;
  titulo: string;
  descripcion?: string;
  link?: string;
  lugar?: string;
  fecha: string;       // YYYY-MM-DD
  horaInicio?: string; // HH:mm
  horaFin?: string;    // HH:mm
  todoDia: boolean;
  estado?: EventoEstado;
  recurrencia: EventoRecurrencia;
  recurrenciaFin?: string;         // YYYY-MM-DD — fecha de fin de la recurrencia
  recurrenciaOcurrencias?: number; // número máximo de ocurrencias
  prioridad: EventoPrioridad;
  color: EventoColor;
  calendarColor?: string | null;
  anotaciones?: Anotacion[]; // notas libres del calendario
  invitados: string[] | 'todos'; // userId[] or 'todos' for whole company
  /** Miembro responsable de cumplir el compromiso (sólo en seguimientos). */
  responsableId?: string;
  /** Qué hay que entregar para que el compromiso se dé por cumplido. */
  entregable?: string;
  /** Presente sólo si el evento nació de un cambio de estado de contacto. */
  origen?: EventoOrigen;
  creadoPor: string;
  /** uid de quien hizo la última edición. */
  updatedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateEventoData = Omit<Evento, 'id' | 'companyId' | 'creadoPor' | 'updatedBy' | 'createdAt' | 'updatedAt'>;

/** Un plazo procesal es un Evento con origen `plazo_procesal`. */
export function esPlazoProcesal(evento: Evento): evento is Evento & { origen: OrigenPlazoProcesal } {
  return evento.origen?.tipo === 'plazo_procesal';
}
