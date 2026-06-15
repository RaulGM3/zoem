import { describe, it, expect } from 'vitest';
import {
  HITO_ESTADOS,
  HITO_ESTADO_LABEL,
  HITO_ESTADO_CALENDAR_STATUS,
  cycleHitoEstado,
  nextHitoEstado,
  prevHitoEstado,
  isHitoOverdue,
  stampEstadoChange,
} from './hito-estado';

describe('hito-estado: single source of truth', () => {
  it('declares the four canonical estados', () => {
    expect(HITO_ESTADOS).toEqual(['pendiente', 'en_progreso', 'completado', 'cancelado']);
  });

  it('has a human label for every estado', () => {
    for (const e of HITO_ESTADOS) {
      expect(HITO_ESTADO_LABEL[e]).toBeTruthy();
      expect(HITO_ESTADO_LABEL[e]).not.toBe(e); // never expose the raw enum
    }
  });

  it('maps en_progreso label to the user-facing "En proceso"', () => {
    expect(HITO_ESTADO_LABEL['en_progreso']).toBe('En proceso');
  });
});

describe('cycleHitoEstado (caso-hitos-tab single-button)', () => {
  it('advances pendiente -> en_progreso -> completado -> pendiente', () => {
    expect(cycleHitoEstado('pendiente')).toBe('en_progreso');
    expect(cycleHitoEstado('en_progreso')).toBe('completado');
    expect(cycleHitoEstado('completado')).toBe('pendiente');
  });

  it('reactivates a cancelado hito to pendiente', () => {
    expect(cycleHitoEstado('cancelado')).toBe('pendiente');
  });
});

describe('nextHitoEstado / prevHitoEstado (calendar advance/revert)', () => {
  it('advances linearly without looping past completado', () => {
    expect(nextHitoEstado('pendiente')).toBe('en_progreso');
    expect(nextHitoEstado('en_progreso')).toBe('completado');
    expect(nextHitoEstado('completado')).toBe('completado');
  });

  it('reverts linearly without going before pendiente', () => {
    expect(prevHitoEstado('completado')).toBe('en_progreso');
    expect(prevHitoEstado('en_progreso')).toBe('pendiente');
    expect(prevHitoEstado('pendiente')).toBe('pendiente');
  });
});

describe('HITO_ESTADO_CALENDAR_STATUS', () => {
  it('maps estado to a calendar status for every estado', () => {
    expect(HITO_ESTADO_CALENDAR_STATUS['pendiente']).toBe('pendiente');
    expect(HITO_ESTADO_CALENDAR_STATUS['en_progreso']).toBe('pendiente');
    expect(HITO_ESTADO_CALENDAR_STATUS['completado']).toBe('confirmada');
    expect(HITO_ESTADO_CALENDAR_STATUS['cancelado']).toBe('cancelada');
  });
});

describe('isHitoOverdue', () => {
  const today = '2026-06-15';

  it('flags a pendiente hito with a past fecha as overdue', () => {
    expect(isHitoOverdue('pendiente', '2026-06-10', today)).toBe(true);
    expect(isHitoOverdue('en_progreso', '2026-06-10', today)).toBe(true);
  });

  it('does not flag completed or cancelled hitos', () => {
    expect(isHitoOverdue('completado', '2026-06-10', today)).toBe(false);
    expect(isHitoOverdue('cancelado', '2026-06-10', today)).toBe(false);
  });

  it('does not flag a hito due today or in the future', () => {
    expect(isHitoOverdue('pendiente', today, today)).toBe(false);
    expect(isHitoOverdue('pendiente', '2026-06-20', today)).toBe(false);
  });

  it('does not flag a hito without a fecha', () => {
    expect(isHitoOverdue('pendiente', undefined, today)).toBe(false);
  });
});

describe('stampEstadoChange', () => {
  it('returns the author and an ISO timestamp', () => {
    const stamp = stampEstadoChange('user-123');
    expect(stamp.estadoActualizadoPor).toBe('user-123');
    expect(stamp.estadoActualizadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('omits the author when there is no current user', () => {
    const stamp = stampEstadoChange(undefined);
    expect(stamp.estadoActualizadoPor).toBeUndefined();
    expect(stamp.estadoActualizadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
