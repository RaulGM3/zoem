import { describe, it, expect } from 'vitest';
import { trimestre, comparaPeriodos } from './trimestre';

describe('trimestre', () => {
  it.each([
    ['2026-01-01', 2026, 1],
    ['2026-03-31', 2026, 1],
    ['2026-04-02', 2026, 2],
    ['2026-06-30', 2026, 2],
    ['2026-07-01', 2026, 3],
    ['2026-09-30', 2026, 3],
    ['2026-10-01', 2026, 4],
    ['2025-12-31', 2025, 4],
  ])('%s -> %i T%i', (fecha, ejercicio, t) => {
    expect(trimestre(fecha)).toEqual({ ejercicio, trimestre: t });
  });

  it('lanza con una fecha ISO inválida', () => {
    expect(() => trimestre('02/04/2026')).toThrow();
    expect(() => trimestre('2026-13-01')).toThrow();
    expect(() => trimestre('2026-02-30')).toThrow();
  });
});

describe('comparaPeriodos', () => {
  it('ordena por ejercicio y luego por trimestre', () => {
    expect(comparaPeriodos({ ejercicio: 2025, trimestre: 4 }, { ejercicio: 2026, trimestre: 1 })).toBeLessThan(0);
    expect(comparaPeriodos({ ejercicio: 2026, trimestre: 2 }, { ejercicio: 2026, trimestre: 2 })).toBe(0);
    expect(comparaPeriodos({ ejercicio: 2026, trimestre: 3 }, { ejercicio: 2026, trimestre: 1 })).toBeGreaterThan(0);
  });
});
