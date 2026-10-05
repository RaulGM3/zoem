import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { CasosService } from './casos.service';
import { CompanyService } from './company.service';
import { PlantillasService } from './plantillas.service';
import { ActividadService } from './actividad.service';

const { mockAddDoc, mockUpdateDoc, mockGetDocs, batchSet, batchUpdate, batchCommit } = vi.hoisted(() => ({
  mockAddDoc: vi.fn().mockResolvedValue({ id: 'caso-1' }),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
  mockGetDocs: vi.fn().mockResolvedValue({ docs: [], size: 0 }),
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue('col'),
  collectionData: vi.fn(),
  doc: vi.fn().mockReturnValue({ id: 'new-id' }),
  getDoc: vi.fn(),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  addDoc: (...a: unknown[]) => mockAddDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  setDoc: vi.fn(),
  writeBatch: () => ({ set: batchSet, update: batchUpdate, delete: vi.fn(), commit: batchCommit }),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: () => '__ts__',
  deleteField: () => '__del__',
  increment: vi.fn(),
  arrayUnion: vi.fn(),
}));

describe('CasosService: campos de actor (updatedBy/createdBy)', () => {
  let service: CasosService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CasosService,
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'me' } } },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1' }) } },
        {
          provide: PlantillasService,
          useValue: {
            getPlantilla: vi.fn().mockResolvedValue({
              hitos: [{ titulo: 'H1', diasDesdeInicio: 1, orden: 1, asignadoA: 'u9' }],
            }),
          },
        },
        { provide: ActividadService, useValue: { log: vi.fn().mockResolvedValue(undefined) } },
      ],
    });
    service = TestBed.inject(CasosService);
    const priv = service as unknown as Record<string, unknown>;
    priv['copyPlantillaDocStructure'] = vi.fn().mockResolvedValue(undefined);
    priv['copyModeloCostos'] = vi.fn().mockResolvedValue(undefined);
  });

  it('createCaso escribe createdBy y updatedBy con el uid actual', async () => {
    await service.createCaso({ titulo: 'T' } as Parameters<CasosService['createCaso']>[0]);
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.createdBy).toBe('me');
    expect(payload.updatedBy).toBe('me');
  });

  it('createCaso: los hitos de plantilla llevan createdBy', async () => {
    await service.createCaso({ titulo: 'T', plantillaId: 'p1' } as Parameters<CasosService['createCaso']>[0]);
    const hito = batchSet.mock.calls[0][1];
    expect(hito.createdBy).toBe('me');
    expect(hito.asignadoA).toBe('u9');
  });

  it('updateCaso escribe updatedBy', async () => {
    await service.updateCaso('k1', { titulo: 'N' });
    expect(mockUpdateDoc.mock.calls[0][1].updatedBy).toBe('me');
  });

  it('updateCaso permite cambiar encargadoId', async () => {
    await service.updateCaso('k1', { encargadoId: 'u2' });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.encargadoId).toBe('u2');
    expect(payload.updatedBy).toBe('me');
  });

  it('updateCaso con encargadoId undefined explícito borra el campo', async () => {
    await service.updateCaso('k1', { encargadoId: undefined });
    expect(mockUpdateDoc.mock.calls[0][1].encargadoId).toBe('__del__');
  });

  it('updateCaso sin encargadoId no toca el campo', async () => {
    await service.updateCaso('k1', { titulo: 'N' });
    expect('encargadoId' in mockUpdateDoc.mock.calls[0][1]).toBe(false);
  });

  it('addHito escribe createdBy', async () => {
    await service.addHito('k1', 'Caso', { titulo: 'H' } as Parameters<CasosService['addHito']>[2]);
    expect(batchSet.mock.calls[0][1].createdBy).toBe('me');
  });

  it('updateHito escribe updatedBy', async () => {
    await service.updateHito('k1', 'h1', { asignadosA: ['u2'] });
    expect(batchUpdate.mock.calls[0][1]).toMatchObject({ asignadosA: ['u2'], updatedBy: 'me' });
  });
});
