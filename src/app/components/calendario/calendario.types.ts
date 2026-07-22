import type { Anotacion, RegistroHoraHito } from '../../interfaces';

export type { Anotacion };

export type ItemColor = 'violet' | 'indigo' | 'blue' | 'green' | 'amber' | 'red' | 'pink' | 'slate';

export interface CalendarItem {
  id: string;
  title: string;
  client: string;
  type: 'reunion' | 'llamada' | 'entrega' | 'recordatorio';
  date: string;
  status: 'confirmada' | 'pendiente' | 'cancelada';
  description?: string;
  hitoEstado?: 'pendiente' | 'en_progreso' | 'completado' | 'cancelado';
  eventoEstado?: 'confirmado' | 'tentativo' | 'en_progreso' | 'completado' | 'cancelado';
  casoId?: string;
  horaInicio?: string;    // HH:mm — hora en la agenda
  duracionMinutos?: number; // duración en minutos (default 60)
  anotaciones?: Anotacion[];
  color?: ItemColor;
  asignadosA?: string[];            // multi-asignación del hito (userIds)
  registrosHoras?: RegistroHoraHito[]; // horas reales declaradas (cobro por horas)
}

export interface WeekDay {
  date: string;
  dayName: string;
  dayNum: number;
  hasEvents: boolean;
  hasUnscheduledHitos: boolean;
  isToday: boolean;
  isSelected: boolean;
  isCurrentMonth?: boolean;
}

export interface EventGroup {
  date: string;
  label: string;
  items: CalendarItem[];
}

export type ViewMode = 'week' | 'month';
