import { Timestamp } from '@angular/fire/firestore';

export type EventoPrioridad = 'alta' | 'media' | 'baja' | 'ninguna';
export type EventoRecurrencia = 'ninguna' | 'diaria' | 'semanal' | 'mensual' | 'anual';
export type EventoColor = 'rojo' | 'naranja' | 'amarillo' | 'verde' | 'azul' | 'violeta' | 'gris';

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
  recurrencia: EventoRecurrencia;
  prioridad: EventoPrioridad;
  color: EventoColor;
  calendarColor?: string | null;
  invitados: string[] | 'todos'; // userId[] or 'todos' for whole company
  creadoPor: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateEventoData = Omit<Evento, 'id' | 'companyId' | 'creadoPor' | 'createdAt' | 'updatedAt'>;
