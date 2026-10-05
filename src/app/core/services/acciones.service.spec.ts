import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { AccionesService } from './acciones.service';
import { CompanyService } from './company.service';

const m = vi.hoisted(() => ({
  addDoc: vi.fn().mockResolvedValue({ id: 'a-1' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  collection: vi.fn((...p: unknown[]) => ({ __col: p.slice(1).join('/') })),
  doc: vi.fn((...p: unknown[]) => ({ __doc: p.slice(1).join('/') })),
  query: vi.fn((...p: unknown[]) => ({ __q: p })),
  where: vi.fn((f: string, op: string, v: unknown) => ({ f, op, v })),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  addDoc: (...a: unknown[]) => m.addDoc(...a),
  updateDoc: (...a: unknown[]) => m.updateDoc(...a),
  deleteDoc: (...a: unknown[]) => m.deleteDoc(...a),
  getDocs: (...a: unknown[]) => m.getDocs(...a),
  getDoc: (...a: unknown[]) => m.getDoc(...a),
  collection: (...a: unknown[]) => m.collection(...a),
  doc: (...a: unknown[]) => m.doc(...a),
  query: (...a: unknown[]) => m.query(...a),
  where: (...a: [string, string, unknown]) => m.where(...a),
  serverTimestamp: () => '__ts__',
}));
vi.mock('@angular/fire/auth', () => ({ Auth: class {} }));

const snapDocs = (items: { id: string; nombre: string }[]) => ({
  docs: items.map((i) => ({ id: i.id, data: () => ({ nombre: i.nombre, companyId: 'c1' }) })),
});

describe('AccionesService', () => {
  let svc: AccionesService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AccionesService,
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u1' } } },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1' }) } },
      ],
    });
    svc = TestBed.inject(AccionesService);
  });

  it('crea en companies/{cid}/acciones con companyId, createdBy y timestamps; sin undefined', async () => {
    const id = await svc.crear({
      nombre: 'Bienvenida', ambito: 'contacto', asunto: 'Hola', cuerpo: 'Texto',
      canales: ['gmail'], activa: true, docTemplateId: undefined,
    });
    expect(id).toBe('a-1');
    expect(m.collection).toHaveBeenCalledWith({}, 'companies', 'c1', 'acciones');
    const payload = m.addDoc.mock.calls[0][1];
    expect(payload).toMatchObject({
      companyId: 'c1', createdBy: 'u1', createdAt: '__ts__', updatedAt: '__ts__', nombre: 'Bienvenida',
    });
    expect('docTemplateId' in payload).toBe(false);
  });

  it('actualiza con updatedAt y sin tocar createdBy/createdAt', async () => {
    await svc.actualizar('a-1', { nombre: 'Nuevo' });
    expect(m.doc).toHaveBeenCalledWith({}, 'companies', 'c1', 'acciones', 'a-1');
    expect(m.updateDoc.mock.calls[0][1]).toEqual({ nombre: 'Nuevo', updatedAt: '__ts__' });
  });

  it('elimina el documento', async () => {
    await svc.eliminar('a-1');
    expect(m.deleteDoc).toHaveBeenCalledWith({ __doc: 'companies/c1/acciones/a-1' });
  });

  it('listarPorAmbito filtra por ámbito y solo activas por defecto; ordena por nombre', async () => {
    m.getDocs.mockResolvedValue(snapDocs([{ id: 'b', nombre: 'Zeta' }, { id: 'a', nombre: 'alfa' }]));
    const r = await svc.listarPorAmbito('caso');
    const wheres = m.where.mock.calls.map((c) => [c[0], c[1], c[2]]);
    expect(wheres).toEqual([['ambito', '==', 'caso'], ['activa', '==', true]]);
    expect(r.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('listarPorAmbito puede incluir inactivas (gestión)', async () => {
    m.getDocs.mockResolvedValue(snapDocs([]));
    await svc.listarPorAmbito('contacto', { soloActivas: false });
    expect(m.where.mock.calls.map((c) => c[0])).toEqual(['ambito']);
  });

  it('listarPorPlantilla filtra por plantillaId', async () => {
    m.getDocs.mockResolvedValue(snapDocs([]));
    await svc.listarPorPlantilla('p1');
    expect(m.where).toHaveBeenCalledWith('plantillaId', '==', 'p1');
  });

  it('listarPorHitoPlantilla filtra por plantilla + hito y solo activas', async () => {
    m.getDocs.mockResolvedValue(snapDocs([{ id: 'a', nombre: 'x' }]));
    const r = await svc.listarPorHitoPlantilla('p1', 'hp1');
    expect(m.where.mock.calls.map((c) => [c[0], c[2]])).toEqual([
      ['plantillaId', 'p1'], ['hitoPlantillaId', 'hp1'], ['activa', true],
    ]);
    expect(r).toHaveLength(1);
  });

  it('obtener devuelve null si no existe', async () => {
    m.getDoc.mockResolvedValue({ exists: () => false });
    expect(await svc.obtener('zzz')).toBeNull();
  });

  it('lanza si no hay empresa activa', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AccionesService,
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u1' } } },
        { provide: CompanyService, useValue: { activeCompany: signal(null) } },
      ],
    });
    await expect(TestBed.inject(AccionesService).listarPorPlantilla('p')).rejects.toThrow('No active company');
  });
});
