import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { destinatariosCasos, puedeVerCasos, type MiembroPermisos } from './destinatarios';

const m = (extra: Partial<MiembroPermisos> = {}): MiembroPermisos => ({ id: 'u1', role: 'Usuario', estado: 'activo', ...extra });

describe('puedeVerCasos (espejo de PermissionService.can("Casos","ver"))', () => {
  it('por defecto todos los roles base ven Casos', () => {
    for (const role of ['Admin', 'Gestor', 'Usuario', 'Viewer']) expect(puedeVerCasos(m({ role }), {})).toBe(true);
  });

  it('rol desconocido o ausente no ve', () => {
    expect(puedeVerCasos(m({ role: 'Otro' }), {})).toBe(false);
    expect(puedeVerCasos(m({ role: undefined }), {})).toBe(false);
  });

  it('la matriz de empresa puede revocar', () => {
    expect(puedeVerCasos(m({ role: 'Viewer' }), { matrizEmpresa: { Casos: { Viewer: { ver: false } } } })).toBe(false);
  });

  it('la matriz de empresa no afecta a Admin', () => {
    expect(puedeVerCasos(m({ role: 'Admin' }), { matrizEmpresa: { Casos: { Gestor: { ver: false } } } })).toBe(true);
  });

  it('el rol custom prevalece sobre la empresa', () => {
    const cfg = {
      matrizEmpresa: { Casos: { Usuario: { ver: false } } },
      rolesCustom: [{ id: 'r1', matrix: { Casos: { ver: true } } }],
    };
    expect(puedeVerCasos(m({ customRoleId: 'r1' }), cfg)).toBe(true);
    expect(puedeVerCasos(m(), cfg)).toBe(false);
  });

  it('el override individual prevalece sobre todo, salvo en Admin', () => {
    const cfg = { rolesCustom: [{ id: 'r1', matrix: { Casos: { ver: true } } }] };
    expect(puedeVerCasos(m({ customRoleId: 'r1', permissionOverrides: { Casos: { ver: false } } }), cfg)).toBe(false);
    expect(puedeVerCasos(m({ role: 'Admin', permissionOverrides: { Casos: { ver: false } } }), cfg)).toBe(true);
  });
});

describe('destinatariosCasos', () => {
  it('solo miembros activos con permiso', () => {
    const ids = destinatariosCasos(
      [
        m({ id: 'a' }),
        m({ id: 'b', estado: 'inactivo' }),
        m({ id: 'c', estado: 'pendiente' }),
        m({ id: 'd', permissionOverrides: { Casos: { ver: false } } }),
        m({ id: 'e', role: 'Admin' }),
      ],
      {},
    );
    expect(ids).toEqual(['a', 'e']);
  });
});

describe('deriva de la matriz base de la app', () => {
  it('ningún rol base tiene Casos en NADA en permissions.ts', () => {
    const src = readFileSync(join(__dirname, '../../../src/app/core/permissions/permissions.ts'), 'utf8');
    const bloque = /Casos: \{([^}]*)\}/.exec(src)?.[1] ?? '';
    expect(bloque).not.toBe('');
    expect(bloque).not.toContain('NADA');
    expect(bloque).not.toMatch(/caps\(false/);
  });
});
