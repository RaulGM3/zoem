import { describe, it, expect } from 'vitest';
import {
  clamp,
  effectiveColor,
  itemTimeLabel,
  memberName,
  minutesToTime,
  minutosAHoras,
  newRegistroId,
  timeToMinutes,
} from './agenda-utils';
import type { CalendarItem } from './calendario.types';
import type { CompanyMember } from '../../interfaces';

function item(extra: Partial<CalendarItem> = {}): CalendarItem {
  return { id: 'i1', title: 'Item', client: '', type: 'reunion', date: '2026-03-10', status: 'pendiente', ...extra };
}

describe('agenda-utils', () => {
  describe('clamp', () => {
    it('acota el valor al rango', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-3, 0, 10)).toBe(0);
      expect(clamp(42, 0, 10)).toBe(10);
    });
  });

  describe('timeToMinutes', () => {
    it('convierte HH:mm a minutos', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('09:30')).toBe(570);
    });

    it('trata como 0 las partes ausentes', () => {
      expect(timeToMinutes('7')).toBe(420);
    });
  });

  describe('minutesToTime', () => {
    it('convierte minutos a HH:mm con ceros a la izquierda', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(570)).toBe('09:30');
    });

    it('acota al rango del día', () => {
      expect(minutesToTime(-20)).toBe('00:00');
      expect(minutesToTime(24 * 60 + 30)).toBe('23:59');
    });
  });

  describe('minutosAHoras', () => {
    it('redondea a dos decimales', () => {
      expect(minutosAHoras(60)).toBe(1);
      expect(minutosAHoras(90)).toBe(1.5);
      expect(minutosAHoras(50)).toBe(0.83);
    });
  });

  describe('newRegistroId', () => {
    it('genera ids no vacíos y distintos', () => {
      const a = newRegistroId();
      expect(a).toBeTruthy();
      expect(newRegistroId()).not.toBe(a);
    });
  });

  describe('effectiveColor', () => {
    it('prioriza el color propio del item', () => {
      expect(effectiveColor(item({ color: 'pink' }))).toBe('pink');
    });

    it('si no tiene color usa el de su tipo', () => {
      expect(effectiveColor(item({ type: 'reunion' }))).toBe('violet');
      expect(effectiveColor(item({ type: 'llamada' }))).toBe('green');
      expect(effectiveColor(item({ type: 'entrega' }))).toBe('blue');
      expect(effectiveColor(item({ type: 'recordatorio' }))).toBe('amber');
    });
  });

  describe('itemTimeLabel', () => {
    it('devuelve vacío si el item no tiene hora', () => {
      expect(itemTimeLabel(item())).toBe('');
    });

    it('muestra el rango usando la duración del item', () => {
      expect(itemTimeLabel(item({ horaInicio: '10:00', duracionMinutos: 90 }))).toBe('10:00 – 11:30');
    });

    it('asume 60 minutos si no hay duración', () => {
      expect(itemTimeLabel(item({ horaInicio: '10:00' }))).toBe('10:00 – 11:00');
    });
  });

  describe('memberName', () => {
    const members = [{ userId: 'u1', nombre: 'Ana' }] as CompanyMember[];

    it('devuelve el nombre del miembro', () => {
      expect(memberName(members, 'u1')).toBe('Ana');
    });

    it('devuelve "Sin asignar" si no lo encuentra', () => {
      expect(memberName(members, 'desconocido')).toBe('Sin asignar');
    });
  });
});
