import { describe, expect, it } from 'vitest';
import { usadoDe } from './uso';

describe('usadoDe', () => {
  const total = { usuarios: 1, plantillas: 4, casosActivos: 7, contactos: 3, documentosBytes: 5 * 1_048_576 };
  const mes = { accionesMes: 12, iaMensajesMes: 9 };
  it('lee cada límite de su contador', () => {
    expect(usadoDe('usuarios', total, mes)).toBe(1);
    expect(usadoDe('plantillas', total, mes)).toBe(4);
    expect(usadoDe('casosActivos', total, mes)).toBe(7);
    expect(usadoDe('contactos', total, mes)).toBe(3);
    expect(usadoDe('accionesMes', total, mes)).toBe(12);
    expect(usadoDe('iaMensajesMes', total, mes)).toBe(9);
  });
  it('documentosMB convierte bytes a MB (redondeo hacia arriba)', () => {
    expect(usadoDe('documentosMB', total, mes)).toBe(5);
    expect(usadoDe('documentosMB', { documentosBytes: 1 }, mes)).toBe(1);
  });
  it('contador ausente = 0', () => {
    expect(usadoDe('plantillas', {}, {})).toBe(0);
    expect(usadoDe('documentosMB', {}, {})).toBe(0);
  });
});
