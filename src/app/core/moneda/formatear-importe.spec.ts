import { describe, expect, it } from 'vitest';
import { formatearImporte, formatearImporteTexto, redondear, simboloMoneda, type FormatoImporte } from './formatear-importe';

const NBSP = '\u00A0';
const norm = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ');

const EUR: FormatoImporte = { moneda: 'EUR', locale: 'es-ES', decimales: 2 };
const COP: FormatoImporte = { moneda: 'COP', locale: 'es-CO', decimales: 0 };
const CLP: FormatoImporte = { moneda: 'CLP', locale: 'es-CL', decimales: 0 };
const MXN: FormatoImporte = { moneda: 'MXN', locale: 'es-MX', decimales: 2 };

describe('formatearImporte', () => {
  it('EUR/es-ES: miles con punto, coma decimal y símbolo al final', () => {
    expect(formatearImporte(1234.5, EUR)).toBe(`1.234,50${NBSP}€`);
  });

  it('agrupa también los miles de 4 cifras (es-ES por defecto no lo hace)', () => {
    expect(norm(formatearImporte(1000, EUR))).toBe('1.000,00 €');
    expect(norm(formatearImporte(12345678.9, EUR))).toBe('12.345.678,90 €');
  });

  it('cero y negativos', () => {
    expect(norm(formatearImporte(0, EUR))).toBe('0,00 €');
    expect(norm(formatearImporte(-1234.5, EUR))).toBe('-1.234,50 €');
  });

  it('un negativo que redondea a cero no muestra signo', () => {
    expect(norm(formatearImporte(-0.001, EUR))).toBe('0,00 €');
  });

  it('COP y CLP no tienen decimales', () => {
    expect(norm(formatearImporte(1234567.4, COP))).toBe('$ 1.234.567');
    expect(norm(formatearImporte(1234567.6, CLP))).toBe('$1.234.568');
  });

  it('MXN con 2 decimales', () => {
    expect(norm(formatearImporte(1234.5, MXN))).toBe('$1,234.50');
  });

  it('null, undefined, NaN e infinitos dan cadena vacía (como el pipe number)', () => {
    expect(formatearImporte(null, EUR)).toBe('');
    expect(formatearImporte(undefined, EUR)).toBe('');
    expect(formatearImporte(NaN, EUR)).toBe('');
    expect(formatearImporte(Infinity, EUR)).toBe('');
  });

  it('decimales 0 sobre EUR para vistas compactas', () => {
    expect(norm(formatearImporte(1234.56, { ...EUR, decimales: 0 }))).toBe('1.235 €');
  });

  it('tolera un importe numérico en cadena', () => {
    expect(norm(formatearImporte('12.5' as unknown as number, EUR))).toBe('12,50 €');
  });
});

describe('formatearImporteTexto', () => {
  it('igual que formatearImporte pero con espacio normal, para textos guardados', () => {
    expect(formatearImporteTexto(1234.5, EUR)).toBe('1.234,50 €');
    expect(formatearImporteTexto(null, EUR)).toBe('');
  });
});

describe('redondear', () => {
  it('redondea a los decimales pedidos', () => {
    expect(redondear(1.005, 2)).toBe(1.01);
    expect(redondear(2.345, 2)).toBe(2.35);
    expect(redondear(1234.56, 0)).toBe(1235);
  });

  it('negativos: mitad se aleja de cero', () => {
    expect(redondear(-1.005, 2)).toBe(-1.01);
    expect(redondear(-2.5, 0)).toBe(-3);
  });

  it('0 decimales en monedas sin decimales', () => {
    expect(redondear(99.5, 0)).toBe(100);
  });

  it('valores no finitos devuelven 0', () => {
    expect(redondear(NaN, 2)).toBe(0);
  });
});

describe('simboloMoneda', () => {
  it('símbolo según moneda y locale', () => {
    expect(simboloMoneda('EUR', 'es-ES')).toBe('€');
    expect(simboloMoneda('COP', 'es-CO')).toBe('$');
    expect(simboloMoneda('CLP', 'es-CL')).toBe('$');
    expect(simboloMoneda('MXN', 'es-MX')).toBe('$');
  });

  it('USD fuera de EE.UU. se distingue', () => {
    expect(simboloMoneda('USD', 'es-ES')).toBe('US$');
  });

  it('moneda inválida devuelve el código', () => {
    expect(simboloMoneda('???', 'es-ES')).toBe('???');
  });
});
