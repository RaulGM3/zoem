import type { CalendarItem, ItemColor } from './calendario.types';
import type { CompanyMember } from '../../interfaces';

/** Duración asumida para un item sin `duracionMinutos`. */
export const DEFAULT_DURATION = 60;

const TYPE_COLOR: Record<string, ItemColor> = {
  reunion:      'violet',
  llamada:      'green',
  entrega:      'blue',
  recordatorio: 'amber',
};

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function minutesToTime(total: number): string {
  const c = clamp(total, 0, 23 * 60 + 59);
  const h = Math.floor(c / 60);
  const m = c % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

/** Minutos expresados en horas, redondeado a dos decimales. */
export function minutosAHoras(minutos: number): number {
  return Math.round((minutos / 60) * 100) / 100;
}

export function newRegistroId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/** Color del item: el propio si lo tiene, si no el de su tipo. */
export function effectiveColor(item: CalendarItem): ItemColor {
  return item.color ?? TYPE_COLOR[item.type] ?? 'slate';
}

export function itemTimeLabel(item: CalendarItem): string {
  if (!item.horaInicio) return '';
  const dur = item.duracionMinutos ?? DEFAULT_DURATION;
  return `${item.horaInicio} – ${minutesToTime(timeToMinutes(item.horaInicio) + dur)}`;
}

/** Nombre del miembro a partir de su userId (para desplegables y resúmenes). */
export function memberName(members: readonly CompanyMember[], userId: string): string {
  return members.find(m => m.userId === userId)?.nombre ?? 'Sin asignar';
}
