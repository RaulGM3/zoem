import { describe, expect, it } from 'vitest';
import { necesitaBienvenida } from './necesita-bienvenida';

describe('necesitaBienvenida', () => {
  it('true: usuario normal sin membresías ni empresa activa', () => {
    expect(necesitaBienvenida({ esSuperuser: false, membresias: 0, empresaActiva: false })).toBe(true);
  });
  it('false si tiene alguna membresía', () => {
    expect(necesitaBienvenida({ esSuperuser: false, membresias: 1, empresaActiva: true })).toBe(false);
  });
  it('false para el superusuario aunque no tenga membresías', () => {
    expect(necesitaBienvenida({ esSuperuser: true, membresias: 0, empresaActiva: false })).toBe(false);
  });
  it('false si hay empresa activa (p. ej. superusuario dentro de una empresa)', () => {
    expect(necesitaBienvenida({ esSuperuser: false, membresias: 0, empresaActiva: true })).toBe(false);
  });
});
