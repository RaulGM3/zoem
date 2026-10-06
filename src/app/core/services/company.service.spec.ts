import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Firestore } from '@angular/fire/firestore';
import { CompanyService, type Company } from './company.service';

const m = vi.hoisted(() => ({
  updateDoc: vi.fn(),
  doc: vi.fn((...a: unknown[]) => ({ path: a.slice(1).join('/') })),
  deleteField: vi.fn(() => '__DELETE__'),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  doc: (...a: unknown[]) => m.doc(...a),
  getDoc: vi.fn(),
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
