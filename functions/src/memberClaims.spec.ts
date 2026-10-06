import { describe, it, expect } from 'vitest';
import { claimsDeMiembro, claimsCambian } from './memberClaims';

describe('claimsDeMiembro', () => {
  it('fija companyId, role y estado preservando el resto de claims', () => {
    expect(claimsDeMiembro({ isSuperUser: true }, 'c1', { role: 'Admin', estado: 'activo' })).toEqual({
      isSuperUser: true,
      companyId: 'c1',
      role: 'Admin',
      estado: 'activo',
    });
  });

  it('pisa los claims de membresía de otra empresa', () => {
    expect(
      claimsDeMiembro({ companyId: 'otra', role: 'Viewer', estado: 'pendiente' }, 'c1', { role: 'Gestor', estado: 'activo' }),
    ).toEqual({ companyId: 'c1', role: 'Gestor', estado: 'activo' });
  });

  it('usa null si el miembro no tiene role o estado', () => {
    expect(claimsDeMiembro({}, 'c1', {})).toEqual({ companyId: 'c1', role: null, estado: null });
  });

  it('miembro inexistente limpia los claims de membresía', () => {
    expect(claimsDeMiembro({ isSuperUser: false, companyId: 'c1', role: 'Admin', estado: 'activo' }, 'c1', null)).toEqual({
      isSuperUser: false,
      companyId: null,
      role: null,
      estado: null,
    });
  });
});

describe('claimsCambian', () => {
  it('false si companyId, role y estado coinciden', () => {
    const c = { companyId: 'c1', role: 'Admin', estado: 'activo' };
    expect(claimsCambian({ ...c, isSuperUser: true }, { ...c, isSuperUser: true })).toBe(false);
  });

  it('true si cambia cualquiera de los tres', () => {
    const c = { companyId: 'c1', role: 'Admin', estado: 'activo' };
    expect(claimsCambian(c, { ...c, companyId: 'c2' })).toBe(true);
    expect(claimsCambian(c, { ...c, role: 'Viewer' })).toBe(true);
    expect(claimsCambian(c, { ...c, estado: 'pendiente' })).toBe(true);
  });

  it('true si antes no había claims', () => {
    expect(claimsCambian({}, { companyId: 'c1', role: 'Admin', estado: 'activo' })).toBe(true);
  });
});
