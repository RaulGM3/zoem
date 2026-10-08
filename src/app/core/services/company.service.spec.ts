import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Firestore } from '@angular/fire/firestore';
import { CLAVE_EMPRESA_SUPERUSER, CompanyService, type Company } from './company.service';

const m = vi.hoisted(() => ({
  updateDoc: vi.fn(),
  doc: vi.fn((...a: unknown[]) => ({ path: a.slice(1).join('/') })),
  deleteField: vi.fn(() => '__DELETE__'),
  getDoc: vi.fn(),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  doc: (...a: unknown[]) => m.doc(...a),
  getDoc: (...a: unknown[]) => m.getDoc(...a),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: (...a: unknown[]) => m.updateDoc(...a),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: () => '__TS__',
  deleteField: () => m.deleteField(),
}));

describe('CompanyService.removeCompanyLogo', () => {
  beforeEach(() => {
    m.updateDoc.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [{ provide: Firestore, useValue: {} }] });
  });

  it('usa deleteField sobre logo y limpia activeCompany.logo', async () => {
    const svc = TestBed.inject(CompanyService);
    const company: Company = {
      id: 'c1', name: 'Acme', slug: 'acme', isActive: true,
      logo: { path: 'companies/c1/branding/logo', url: 'u', contentType: 'image/png', updatedAt: '2026-01-01T00:00:00Z' },
    };
    svc.activeCompany.set(company);

    await svc.removeCompanyLogo('c1');

    const [ref, data] = m.updateDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'companies/c1' });
    expect(data).toEqual({ logo: '__DELETE__', updatedAt: '__TS__' });
    expect(svc.activeCompany()?.logo).toBeUndefined();
  });

  it('no toca activeCompany de otra empresa', async () => {
    const svc = TestBed.inject(CompanyService);
    const otra: Company = { id: 'c2', name: 'B', slug: 'b', isActive: true, logo: { path: 'p', url: 'u', contentType: 'image/png', updatedAt: 'x' } };
    svc.activeCompany.set(otra);
    await svc.removeCompanyLogo('c1');
    expect(svc.activeCompany()?.logo).toBeDefined();
  });
});

describe('CompanyService · modo superusuario', () => {
  const acme: Company = { id: 'c1', name: 'Acme', slug: 'acme', isActive: true };
  const assign = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    assign.mockReset();
    m.getDoc.mockReset().mockResolvedValue({ exists: () => true, id: 'c1', data: () => ({ name: 'Acme', slug: 'acme', isActive: true }) });
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: DOCUMENT, useValue: { location: { assign } } },
      ],
    });
  });

  it('entrarComoSuperuser persiste la empresa y recarga la app en el inicio', () => {
    TestBed.inject(CompanyService).entrarComoSuperuser('c1');
    expect(localStorage.getItem(CLAVE_EMPRESA_SUPERUSER)).toBe('c1');
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('modoSuperuser es true solo si la empresa activa no es una membresía propia', () => {
    const svc = TestBed.inject(CompanyService);
    svc.activeCompany.set(acme);
    expect(svc.modoSuperuser()).toBe(true);
    svc.myMemberships.set([{ id: 'u1', companyId: 'c1', userId: 'u1', role: 'Admin', company: acme }]);
    expect(svc.modoSuperuser()).toBe(false);
  });

  it('modoSuperuser es false sin empresa activa', () => {
    expect(TestBed.inject(CompanyService).modoSuperuser()).toBe(false);
  });

  it('restaurarEmpresaSuperuser carga la empresa guardada', async () => {
    localStorage.setItem(CLAVE_EMPRESA_SUPERUSER, 'c1');
    const svc = TestBed.inject(CompanyService);
    await svc.restaurarEmpresaSuperuser();
    expect(m.getDoc.mock.calls[0][0]).toEqual({ path: 'companies/c1' });
    expect(svc.activeCompany()?.id).toBe('c1');
  });

  it('restaurarEmpresaSuperuser no hace nada sin empresa guardada', async () => {
    const svc = TestBed.inject(CompanyService);
    await svc.restaurarEmpresaSuperuser();
    expect(m.getDoc).not.toHaveBeenCalled();
    expect(svc.activeCompany()).toBeNull();
  });

  it('restaurarEmpresaSuperuser olvida una empresa guardada que ya no existe', async () => {
    localStorage.setItem(CLAVE_EMPRESA_SUPERUSER, 'borrada');
    m.getDoc.mockResolvedValue({ exists: () => false });
    const svc = TestBed.inject(CompanyService);
    await svc.restaurarEmpresaSuperuser();
    expect(svc.activeCompany()).toBeNull();
    expect(localStorage.getItem(CLAVE_EMPRESA_SUPERUSER)).toBeNull();
  });

  it('salirModoSuperuser olvida la empresa y recarga en el panel de superusuario', () => {
    localStorage.setItem(CLAVE_EMPRESA_SUPERUSER, 'c1');
    TestBed.inject(CompanyService).salirModoSuperuser();
    expect(localStorage.getItem(CLAVE_EMPRESA_SUPERUSER)).toBeNull();
    expect(assign).toHaveBeenCalledWith('/superuser/companies');
  });
});
