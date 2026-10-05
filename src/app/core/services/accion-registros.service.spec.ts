import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { AccionRegistrosService } from './accion-registros.service';
import { CompanyService } from './company.service';

const m = vi.hoisted(() => ({
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn(),
  collection: vi.fn((...p: unknown[]) => ({ __col: p.slice(1).join('/') })),
  doc: vi.fn((...p: unknown[]) => ({ __doc: p.slice(1).join('/'), id: p.length === 1 ? 'auto-id' : p[p.length - 1] })),
  query: vi.fn((...p: unknown[]) => ({ __q: p })),
  where: vi.fn((f: string, op: string, v: unknown) => ({ w: [f, op, v] })),
  orderBy: vi.fn((f: string, d: string) => ({ o: [f, d] })),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  setDoc: (...a: unknown[]) => m.setDoc(...a),
  getDocs: (...a: unknown[]) => m.getDocs(...a),
  collection: (...a: unknown[]) => m.collection(...a),
  doc: (...a: unknown[]) => m.doc(...a),
  query: (...a: unknown[]) => m.query(...a),
  where: (...a: [string, string, unknown]) => m.where(...a),
  orderBy: (...a: [string, string]) => m.orderBy(...a),
  serverTimestamp: () => '__ts__',
}));
vi.mock('@angular/fire/auth', () => ({ Auth: class {} }));

describe('AccionRegistrosService', () => {
  let svc: AccionRegistrosService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AccionRegistrosService,
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u1' } } },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1' }) } },
      ],
    });
    svc = TestBed.inject(AccionRegistrosService);
  });

  it('nuevoId reserva un id sin escribir', () => {
    expect(svc.nuevoId()).toBe('auto-id');
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('crear escribe el registro con id dado, companyId, createdBy y createdAt', async () => {
    await svc.crear('r1', {
      accionId: 'a1', accionNombre: 'Bienvenida', contactoIds: ['k1'], canal: 'gmail', casoId: undefined,
    });
    expect(m.doc).toHaveBeenLastCalledWith({}, 'companies', 'c1', 'accion_registros', 'r1');
    const payload = m.setDoc.mock.calls[0][1];
    expect(payload).toMatchObject({
      companyId: 'c1', createdBy: 'u1', createdAt: '__ts__', accionId: 'a1', contactoIds: ['k1'], canal: 'gmail',
    });
    expect('casoId' in payload).toBe(false);
    expect('id' in payload).toBe(false);
  });

  it('listarPorContacto: array-contains + createdAt desc', async () => {
    m.getDocs.mockResolvedValue({ docs: [{ id: 'r1', data: () => ({ accionNombre: 'x' }) }] });
    const r = await svc.listarPorContacto('k1');
    expect(m.where).toHaveBeenCalledWith('contactoIds', 'array-contains', 'k1');
    expect(m.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(r).toEqual([{ id: 'r1', accionNombre: 'x' }]);
  });

  it('listarPorCaso: casoId == + createdAt desc', async () => {
    m.getDocs.mockResolvedValue({ docs: [] });
    await svc.listarPorCaso('cs1');
    expect(m.where).toHaveBeenCalledWith('casoId', '==', 'cs1');
    expect(m.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  });
});
