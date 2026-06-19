import { describe, it, expect } from 'vitest';
import { can, PERMISOS, MODULOS, CAPABILITIES, type Modulo } from './permissions';

describe('can (lógica pura de permisos)', () => {
  it('el superusuario puede todo, sin importar rol ni módulo', () => {
    expect(can(null, true, 'Configuración', 'eliminar')).toBe(true);
    expect(can('Viewer', true, 'Tesorería', 'eliminar')).toBe(true);
  });

  it('sin rol y sin ser superusuario no puede nada', () => {
    expect(can(null, false, 'Casos', 'ver')).toBe(false);
  });

  it('Admin tiene las cuatro capacidades en todos los módulos', () => {
    for (const m of MODULOS) {
      for (const c of CAPABILITIES) {
        expect(can('Admin', false, m, c)).toBe(true);
      }
    }
  });

  it('Viewer solo puede ver donde tiene acceso, nunca crear/editar/eliminar', () => {
    expect(can('Viewer', false, 'Casos', 'ver')).toBe(true);
    expect(can('Viewer', false, 'Casos', 'crear')).toBe(false);
    expect(can('Viewer', false, 'Casos', 'editar')).toBe(false);
    expect(can('Viewer', false, 'Casos', 'eliminar')).toBe(false);
  });

  it('Viewer no accede a Tesorería ni Configuración', () => {
    expect(can('Viewer', false, 'Tesorería', 'ver')).toBe(false);
    expect(can('Viewer', false, 'Configuración', 'ver')).toBe(false);
  });

  it('Gestor gestiona finanzas pero no Configuración', () => {
    expect(can('Gestor', false, 'Tesorería', 'crear')).toBe(true);
    expect(can('Gestor', false, 'Facturación', 'editar')).toBe(true);
    expect(can('Gestor', false, 'Configuración', 'ver')).toBe(false);
  });

  it('Usuario opera en módulos básicos pero no borra ni toca Tesorería', () => {
    expect(can('Usuario', false, 'Casos', 'crear')).toBe(true);
    expect(can('Usuario', false, 'Casos', 'eliminar')).toBe(false);
    expect(can('Usuario', false, 'Tesorería', 'ver')).toBe(false);
  });

  it('un módulo desconocido devuelve false (fallback seguro, sin short-circuit de Admin)', () => {
    expect(can('Admin', false, 'NoExiste' as Modulo, 'ver')).toBe(false);
    expect(can('Usuario', false, 'NoExiste' as Modulo, 'ver')).toBe(false);
  });

  it('la matriz cubre todos los módulos y roles', () => {
    for (const m of MODULOS) {
      expect(PERMISOS[m]).toBeDefined();
      for (const rol of ['Admin', 'Gestor', 'Usuario', 'Viewer'] as const) {
        expect(PERMISOS[m][rol]).toBeDefined();
      }
    }
  });
});
