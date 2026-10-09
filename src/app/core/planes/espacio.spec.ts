import { describe, expect, it } from 'vitest';
import { evaluarEspacio, mensajeSinEspacio } from './espacio';

const MB = 1_048_576;

describe('evaluarEspacio', () => {
  it('cabe si usado + archivo <= límite (justo incluido)', () => {
    expect(evaluarEspacio({ usadoBytes: 499 * MB, limiteMB: 500, bytes: MB })).toEqual({ cabe: true });
  });
  it('no cabe por un byte y dice cuánto queda', () => {
    expect(evaluarEspacio({ usadoBytes: 499 * MB, limiteMB: 500, bytes: MB + 1 })).toEqual({ cabe: false, quedanMB: 1 });
  });
  it('quedan MB redondeados hacia abajo y nunca negativos', () => {
    expect(evaluarEspacio({ usadoBytes: 498.5 * MB, limiteMB: 500, bytes: 5 * MB })).toEqual({ cabe: false, quedanMB: 1 });
    expect(evaluarEspacio({ usadoBytes: 600 * MB, limiteMB: 500, bytes: 1 })).toEqual({ cabe: false, quedanMB: 0 });
  });
  it('ilimitado (Infinity) siempre cabe', () => {
    expect(evaluarEspacio({ usadoBytes: 10 ** 15, limiteMB: Infinity, bytes: 10 ** 12 })).toEqual({ cabe: true });
  });
});

describe('mensajeSinEspacio', () => {
  it('indica los MB que quedan y los que ocupa el archivo', () => {
    expect(mensajeSinEspacio(12, 20 * MB)).toBe('No queda espacio: te quedan 12 MB y el archivo ocupa 20 MB.');
  });
  it('con menos de 1 MB lo dice claro', () => {
    expect(mensajeSinEspacio(0, 5 * MB)).toBe('No queda espacio: te quedan menos de 1 MB y el archivo ocupa 5 MB.');
  });
  it('archivos pequeños: un decimal con coma, redondeado hacia arriba', () => {
    expect(mensajeSinEspacio(0, 300_000)).toBe('No queda espacio: te quedan menos de 1 MB y el archivo ocupa 0,3 MB.');
    expect(mensajeSinEspacio(0, 100)).toBe('No queda espacio: te quedan menos de 1 MB y el archivo ocupa 0,1 MB.');
  });
  it('archivos grandes: MB enteros hacia arriba', () => {
    expect(mensajeSinEspacio(3, 12.2 * MB)).toBe('No queda espacio: te quedan 3 MB y el archivo ocupa 13 MB.');
  });
});
