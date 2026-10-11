import { describe, expect, it } from 'vitest';
import { formatoDeEmpresa, simboloDeFormato, stepImporte } from './formato-empresa';

describe('formatoDeEmpresa', () => {
  it('sin empresa o sin país/moneda: EUR es-ES', () => {
    const esperado = { moneda: 'EUR', locale: 'es-ES', decimales: 2 };
    expect(formatoDeEmpresa(null)).toEqual(esperado);
    expect(formatoDeEmpresa({})).toEqual(esperado);
  });

  it('Colombia: COP sin decimales', () => {
    expect(formatoDeEmpresa({ pais: 'CO', moneda: 'COP' })).toEqual({ moneda: 'COP', locale: 'es-CO', decimales: 0 });
  });

  it('USD en un despacho chileno: locale del país, 2 decimales', () => {
    expect(formatoDeEmpresa({ pais: 'CL', moneda: 'USD' })).toEqual({ moneda: 'USD', locale: 'es-CL', decimales: 2 });
  });

  it('solo país: usa su moneda local', () => {
    expect(formatoDeEmpresa({ pais: 'MX' }).moneda).toBe('MXN');
  });
});

describe('stepImporte', () => {
  it('0.01 con 2 decimales, 1 sin decimales', () => {
    expect(stepImporte(2)).toBe('0.01');
    expect(stepImporte(0)).toBe('1');
  });
});

describe('simboloDeFormato', () => {
  it('€ para EUR', () => {
    expect(simboloDeFormato({ moneda: 'EUR', locale: 'es-ES', decimales: 2 })).toBe('€');
  });
});
