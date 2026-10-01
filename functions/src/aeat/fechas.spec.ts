import { describe, it, expect } from 'vitest';
import { fechaAeat, fechaHoraHuso } from './fechas';

describe('fechaAeat', () => {
  it('convierte yyyy-MM-dd a dd-MM-yyyy', () => {
    expect(fechaAeat('2024-01-01')).toBe('01-01-2024');
    expect(fechaAeat('2026-12-31')).toBe('31-12-2026');
  });

  it('rechaza formatos inválidos', () => {
    expect(() => fechaAeat('01-01-2024')).toThrow();
    expect(() => fechaAeat('2024-1-1')).toThrow();
    expect(() => fechaAeat('')).toThrow();
  });
});

describe('fechaHoraHuso (Europe/Madrid)', () => {
  it('invierno: +01:00 (vector oficial 19:20:30)', () => {
    expect(fechaHoraHuso(new Date('2024-01-01T18:20:30Z'))).toBe('2024-01-01T19:20:30+01:00');
  });

  it('verano: +02:00', () => {
    expect(fechaHoraHuso(new Date('2024-07-01T10:20:30Z'))).toBe('2024-07-01T12:20:30+02:00');
  });

  it('cambio a horario de verano (31-03-2024 01:00Z)', () => {
    expect(fechaHoraHuso(new Date('2024-03-31T00:59:59Z'))).toBe('2024-03-31T01:59:59+01:00');
    expect(fechaHoraHuso(new Date('2024-03-31T01:00:00Z'))).toBe('2024-03-31T03:00:00+02:00');
  });

  it('cambio a horario de invierno (27-10-2024 01:00Z)', () => {
    expect(fechaHoraHuso(new Date('2024-10-27T00:59:59Z'))).toBe('2024-10-27T02:59:59+02:00');
    expect(fechaHoraHuso(new Date('2024-10-27T01:00:00Z'))).toBe('2024-10-27T02:00:00+01:00');
  });

  it('medianoche local se formatea como 00, no 24', () => {
    expect(fechaHoraHuso(new Date('2024-01-01T23:00:00Z'))).toBe('2024-01-02T00:00:00+01:00');
  });

  it('precisión de segundos: descarta milisegundos', () => {
    expect(fechaHoraHuso(new Date('2024-01-01T18:20:30.987Z'))).toBe('2024-01-01T19:20:30+01:00');
  });

  it('fecha inválida lanza', () => {
    expect(() => fechaHoraHuso(new Date('nope'))).toThrow();
  });
});
