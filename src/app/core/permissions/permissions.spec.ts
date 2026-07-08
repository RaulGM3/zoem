import { describe, it, expect } from 'vitest';
import {
  can,
  resolveCan,
  effectiveMatrix,
  diffMatrix,
  PERMISOS,
  MODULOS,
  CAPABILITIES,
  FIRM_ROLES_MATRIZ,
  isCellGrantable,
  customRoleCaps,
  type Modulo,
  type MatrixOverride,
  type UserPermissionOverrides,
  type CustomRoleMatrix,
} from './permissions';
import type { FirmRole } from '../../interfaces/member';

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

describe('resolveCan (matriz de empresa + overrides de usuario)', () => {
  const ROLES: FirmRole[] = ['Admin', 'Gestor', 'Usuario', 'Viewer'];

  it('sin matriz de empresa ni overrides es idéntico a can() en las 9x4x4 celdas', () => {
    for (const m of MODULOS) {
      for (const rol of ROLES) {
        for (const c of CAPABILITIES) {
          expect(resolveCan(rol, false, m, c)).toBe(can(rol, false, m, c));
        }
      }
    }
  });

  it('la matriz de empresa pisa la base: revocar crear a Usuario en Casos', () => {
    const matrix: MatrixOverride = { Casos: { Usuario: { crear: false } } };
    expect(resolveCan('Usuario', false, 'Casos', 'crear', matrix)).toBe(false);
    // las celdas no tocadas heredan la base
    expect(resolveCan('Usuario', false, 'Casos', 'editar', matrix)).toBe(true);
    expect(resolveCan('Gestor', false, 'Casos', 'crear', matrix)).toBe(true);
  });

  it('la matriz de empresa puede conceder: dar eliminar a Usuario en Contactos', () => {
    const matrix: MatrixOverride = { Contactos: { Usuario: { eliminar: true } } };
    expect(resolveCan('Usuario', false, 'Contactos', 'eliminar', matrix)).toBe(true);
  });

  it('el override de usuario gana a la matriz de empresa', () => {
    const matrix: MatrixOverride = { Casos: { Usuario: { crear: false } } };
    const overrides: UserPermissionOverrides = { Casos: { crear: true } };
    expect(resolveCan('Usuario', false, 'Casos', 'crear', matrix, overrides)).toBe(true);
  });

  it('un override false revoca aunque base y empresa lo permitan', () => {
    const overrides: UserPermissionOverrides = { Casos: { ver: false } };
    expect(resolveCan('Usuario', false, 'Casos', 'ver', undefined, overrides)).toBe(false);
  });

  it('la ausencia de la capacidad en el override hereda la cadena empresa → base', () => {
    const matrix: MatrixOverride = { Casos: { Usuario: { crear: false } } };
    const overrides: UserPermissionOverrides = { Casos: { editar: false } };
    expect(resolveCan('Usuario', false, 'Casos', 'crear', matrix, overrides)).toBe(false);
    expect(resolveCan('Usuario', false, 'Casos', 'ver', matrix, overrides)).toBe(true);
  });

  it('Admin es inmune a matriz de empresa y overrides', () => {
    const matrix = { Casos: { Admin: { ver: false } } } as unknown as MatrixOverride;
    const overrides: UserPermissionOverrides = { Casos: { ver: false } };
    expect(resolveCan('Admin', false, 'Casos', 'ver', matrix, overrides)).toBe(true);
    expect(resolveCan('Admin', false, 'Tesorería', 'eliminar', matrix, overrides)).toBe(true);
  });

  it('el superusuario pasa por encima de todo', () => {
    const overrides: UserPermissionOverrides = { Casos: { ver: false } };
    expect(resolveCan('Viewer', true, 'Configuración', 'eliminar', undefined, overrides)).toBe(true);
    expect(resolveCan(null, true, 'Casos', 'ver')).toBe(true);
  });

  it('sin rol y sin superusuario, nada — ni con overrides', () => {
    const overrides: UserPermissionOverrides = { Casos: { ver: true } };
    expect(resolveCan(null, false, 'Casos', 'ver', undefined, overrides)).toBe(false);
  });
});

describe('effectiveMatrix / diffMatrix', () => {
  it('sin matriz de empresa, effectiveMatrix devuelve la base', () => {
    expect(effectiveMatrix()).toEqual(PERMISOS);
    expect(effectiveMatrix({})).toEqual(PERMISOS);
  });

  it('effectiveMatrix aplica los deltas sin mutar la base', () => {
    const matrix: MatrixOverride = { Casos: { Usuario: { crear: false } } };
    const eff = effectiveMatrix(matrix);
    expect(eff['Casos']['Usuario']['crear']).toBe(false);
    expect(eff['Casos']['Usuario']['editar']).toBe(true);
    expect(PERMISOS['Casos']['Usuario']['crear']).toBe(true); // base intacta
  });

  it('effectiveMatrix nunca altera la fila de Admin', () => {
    const matrix = { Casos: { Admin: { ver: false } } } as unknown as MatrixOverride;
    expect(effectiveMatrix(matrix)['Casos']['Admin']['ver']).toBe(true);
  });

  it('diffMatrix devuelve solo las celdas que difieren de la base (sparse)', () => {
    const edited = effectiveMatrix({ Casos: { Usuario: { crear: false } } });
    const delta = diffMatrix(edited);
    expect(delta).toEqual({ Casos: { Usuario: { crear: false } } });
  });

  it('diffMatrix de la base es el delta vacío', () => {
    expect(diffMatrix(effectiveMatrix())).toEqual({});
  });

  it('diffMatrix y effectiveMatrix son inversas', () => {
    const matrix: MatrixOverride = {
      Casos: { Usuario: { crear: false, eliminar: true } },
      Informes: { Viewer: { ver: false } },
    };
    expect(diffMatrix(effectiveMatrix(matrix))).toEqual(matrix);
  });

  it('diffMatrix ignora la columna Admin aunque el editor la pase alterada', () => {
    const edited = structuredClone(effectiveMatrix()) as Record<
      Modulo,
      Record<FirmRole, Record<string, boolean>>
    >;
    edited['Casos']['Admin']['ver'] = false;
    expect(diffMatrix(edited as never)).toEqual({});
  });

  it('FIRM_ROLES_MATRIZ expone los roles configurables (sin Admin)', () => {
    expect(FIRM_ROLES_MATRIZ).toEqual(['Gestor', 'Usuario', 'Viewer']);
  });
});

describe('resolveCan con rol custom (matriz propia anclada a un rol base)', () => {
  const customMatrix: CustomRoleMatrix = {
    Casos: { eliminar: true },        // concede sobre la base de Usuario
    Contactos: { crear: false },      // revoca sobre la base de Usuario
  };

  it('la matriz del rol custom pisa la base de su rol base', () => {
    expect(resolveCan('Usuario', false, 'Casos', 'eliminar', undefined, undefined, customMatrix)).toBe(true);
    expect(resolveCan('Usuario', false, 'Contactos', 'crear', undefined, undefined, customMatrix)).toBe(false);
  });

  it('celdas no definidas en el rol custom heredan empresa → base', () => {
    expect(resolveCan('Usuario', false, 'Casos', 'ver', undefined, undefined, customMatrix)).toBe(true);
    const company: MatrixOverride = { Calendario: { Usuario: { crear: false } } };
    expect(resolveCan('Usuario', false, 'Calendario', 'crear', company, undefined, customMatrix)).toBe(false);
  });

  it('el rol custom gana a la matriz de empresa pero pierde con el override de usuario', () => {
    const company: MatrixOverride = { Casos: { Usuario: { eliminar: false } } };
    expect(resolveCan('Usuario', false, 'Casos', 'eliminar', company, undefined, customMatrix)).toBe(true);
    const overrides: UserPermissionOverrides = { Casos: { eliminar: false } };
    expect(resolveCan('Usuario', false, 'Casos', 'eliminar', company, overrides, customMatrix)).toBe(false);
  });

  it('el superusuario y Admin ignoran el rol custom', () => {
    const revocaTodo: CustomRoleMatrix = { Casos: { ver: false } };
    expect(resolveCan('Admin', false, 'Casos', 'ver', undefined, undefined, revocaTodo)).toBe(true);
    expect(resolveCan(null, true, 'Casos', 'ver', undefined, undefined, revocaTodo)).toBe(true);
  });
});

describe('customRoleCaps (matriz efectiva de un rol custom para la UI)', () => {
  it('fusiona base del rol base + empresa + matriz custom', () => {
    const custom: CustomRoleMatrix = { Casos: { eliminar: true } };
    const company: MatrixOverride = { Casos: { Usuario: { editar: false } } };
    const caps = customRoleCaps('Usuario', custom, company);
    expect(caps['Casos']).toEqual({ ver: true, crear: true, editar: false, eliminar: true });
    // módulos sin delta = base del rol base
    expect(caps['Tesorería']).toEqual(PERMISOS['Tesorería']['Usuario']);
  });
});

describe('isCellGrantable (envelope de las security rules)', () => {
  it('ver siempre es concedible (las rules dejan leer a cualquier miembro)', () => {
    expect(isCellGrantable('Casos', 'Viewer', 'ver')).toBe(true);
    expect(isCellGrantable('Informes', 'Usuario', 'ver')).toBe(true);
  });

  it('Viewer nunca puede recibir capacidades de escritura (rules: canWrite excluye Viewer)', () => {
    expect(isCellGrantable('Casos', 'Viewer', 'crear')).toBe(false);
    expect(isCellGrantable('Contactos', 'Viewer', 'editar')).toBe(false);
    expect(isCellGrantable('Casos', 'Viewer', 'eliminar')).toBe(false);
  });

  it('Usuario no puede recibir escritura en finanzas (rules: isManager)', () => {
    expect(isCellGrantable('Facturación', 'Usuario', 'crear')).toBe(false);
    expect(isCellGrantable('Tesorería', 'Usuario', 'editar')).toBe(false);
    expect(isCellGrantable('Facturación', 'Gestor', 'crear')).toBe(true);
  });

  it('Configuración solo admite conceder ver (gestión de miembros es admin-only en rules)', () => {
    expect(isCellGrantable('Configuración', 'Gestor', 'editar')).toBe(false);
    expect(isCellGrantable('Configuración', 'Usuario', 'crear')).toBe(false);
    expect(isCellGrantable('Configuración', 'Gestor', 'ver')).toBe(true);
  });

  it('los módulos operativos son concedibles para Gestor y Usuario', () => {
    expect(isCellGrantable('Casos', 'Usuario', 'eliminar')).toBe(true);
    expect(isCellGrantable('Documentos', 'Gestor', 'crear')).toBe(true);
  });
});
