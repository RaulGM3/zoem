import type { CalendarItem, EventGroup } from '../calendario.types';
import type { CompanyMember, RegistroHoraHito } from '../../../interfaces';

/** Datos de prueba compartidos por los specs del calendario. */

export const FECHA = '2026-03-10';

export const MEMBERS = [
  { id: 'm1', userId: 'u1', nombre: 'Ana' },
  { id: 'm2', userId: 'u2', nombre: 'Luis' },
] as CompanyMember[];

export function evento(extra: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: 'ev1',
    title: 'Reunión inicial',
    client: 'Acme',
    type: 'reunion',
    date: FECHA,
    status: 'confirmada',
    eventoEstado: 'confirmado',
    horaInicio: '10:00',
    duracionMinutos: 60,
    ...extra,
  };
}

export function hito(extra: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: 'h1',
    title: 'Presentar demanda',
    client: 'Acme',
    type: 'entrega',
    date: FECHA,
    status: 'pendiente',
    hitoEstado: 'pendiente',
    casoId: 'c1',
    asignadosA: ['u2'],
    ...extra,
  };
}

export function registro(extra: Partial<RegistroHoraHito> = {}): RegistroHoraHito {
  return { id: 'r1', userId: 'u1', fecha: FECHA, horaInicio: '09:00', horaFin: '10:00', minutos: 60, ...extra };
}

export function grupos(...items: CalendarItem[]): EventGroup[] {
  return [{ date: FECHA, label: 'Mar 10', items }];
}

export function plazo(extra: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: 'p1',
    title: 'Vence plazo: Contestación',
    client: 'Todo el día',
    type: 'reunion',
    date: FECHA,
    status: 'confirmada',
    eventoEstado: 'confirmado',
    casoId: 'caso9',
    plazo: { requiereRevision: false },
    ...extra,
  };
}
