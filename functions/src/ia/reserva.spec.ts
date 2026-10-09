import { describe, expect, it } from 'vitest';
import { decidirReserva, validarReserva } from './reserva';

describe('validarReserva', () => {
  it('exige companyId y n entero entre 1 y 5 (por defecto 1)', () => {
    expect(validarReserva({ companyId: 'c1' })).toEqual({ ok: true, valor: { companyId: 'c1', n: 1 } });
    expect(validarReserva({ companyId: 'c1', n: 3 })).toEqual({ ok: true, valor: { companyId: 'c1', n: 3 } });
  });
  it('rechaza datos no válidos', () => {
    for (const d of [null, {}, { companyId: '' }, { companyId: 'c1', n: 0 }, { companyId: 'c1', n: 6 }, { companyId: 'c1', n: 1.5 }, { companyId: 7 }]) {
      expect(validarReserva(d).ok).toBe(false);
    }
  });
});

describe('decidirReserva', () => {
  it('sin límite (null) siempre concede', () => {
    expect(decidirReserva({ usado: 999, limite: null, n: 1 })).toEqual({ ok: true, usado: 1000 });
  });
  it('concede mientras usado + n <= límite', () => {
    expect(decidirReserva({ usado: 28, limite: 30, n: 2 })).toEqual({ ok: true, usado: 30 });
  });
  it('rechaza al pasar el límite y no consume nada', () => {
    expect(decidirReserva({ usado: 30, limite: 30, n: 1 })).toEqual({ ok: false, usado: 30, limite: 30 });
    expect(decidirReserva({ usado: 29, limite: 30, n: 2 })).toEqual({ ok: false, usado: 29, limite: 30 });
  });
  it('límite 0 = función no disponible', () => {
    expect(decidirReserva({ usado: 0, limite: 0, n: 1 }).ok).toBe(false);
  });
});
