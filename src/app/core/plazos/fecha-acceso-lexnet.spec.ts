import { describe, it, expect } from 'vitest';
import { fechaNotificacionEfectiva } from './fecha-acceso-lexnet';
import type { ContextoCalendario } from './calendario-judicial';

const ctx: ContextoCalendario = { jurisdiccion: 'civil', diasRojos: new Map() };

describe('fechaNotificacionEfectiva (art. 162 LEC)', () => {
  it('sin acceso: puesta a disposición + 3 días hábiles', () => {
    expect(fechaNotificacionEfectiva('2026-07-20', undefined, ctx)).toBe('2026-07-23');
  });
  it('sin acceso desde jueves salta el fin de semana', () => {
    expect(fechaNotificacionEfectiva('2026-07-23', undefined, ctx)).toBe('2026-07-28');
  });
  it('acceso dentro de los 3 días hábiles: se usa el acceso real', () => {
    expect(fechaNotificacionEfectiva('2026-07-20', '2026-07-22', ctx)).toBe('2026-07-22');
    expect(fechaNotificacionEfectiva('2026-07-20', '2026-07-23', ctx)).toBe('2026-07-23');
  });
  it('acceso el mismo día de la puesta a disposición', () => {
    expect(fechaNotificacionEfectiva('2026-07-20', '2026-07-20', ctx)).toBe('2026-07-20');
  });
  it('acceso posterior al límite: rige el límite de 3 días hábiles', () => {
    expect(fechaNotificacionEfectiva('2026-07-20', '2026-07-27', ctx)).toBe('2026-07-23');
  });
  it('acceso anterior a la puesta a disposición se ignora', () => {
    expect(fechaNotificacionEfectiva('2026-07-20', '2026-07-10', ctx)).toBe('2026-07-23');
  });
  it('respeta agosto inhábil', () => {
    expect(fechaNotificacionEfectiva('2026-07-30', undefined, ctx)).toBe('2026-09-02');
  });
});
