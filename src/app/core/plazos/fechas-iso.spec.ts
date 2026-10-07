import { describe, it, expect } from 'vitest';
import { diaSemana, sumarDias, sumarMeses, anioDe } from './fechas-iso';

describe('fechas-iso', () => {
  it('diaSemana (0=domingo)', () => {
    expect(diaSemana('2026-07-20')).toBe(1);
    expect(diaSemana('2026-07-25')).toBe(6);
    expect(diaSemana('2026-07-26')).toBe(0);
  });
  it('sumarDias cruza mes y año', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('sumarMeses recorta al último día del mes', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2028-01-31', 1)).toBe('2028-02-29');
    expect(sumarMeses('2028-02-29', 12)).toBe('2029-02-28');
    expect(sumarMeses('2026-11-30', 3)).toBe('2027-02-28');
  });
  it('anioDe', () => {
    expect(anioDe('2026-07-20')).toBe(2026);
  });
});
