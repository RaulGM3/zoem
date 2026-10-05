import { describe, it, expect } from 'vitest';
import { fechaCorta } from './fecha-corta';

describe('fechaCorta', () => {
  it('formatea una fecha ISO como "d mmm aaaa" en español', () => {
    expect(fechaCorta('2026-09-01')).toBe('1 sep 2026');
    expect(fechaCorta('2026-12-25')).toBe('25 dic 2026');
  });

  it('devuelve el texto original si no es una fecha ISO válida', () => {
    expect(fechaCorta('')).toBe('');
    expect(fechaCorta('mañana')).toBe('mañana');
    expect(fechaCorta('2026-13-01')).toBe('2026-13-01');
  });
});
