import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { EventosService } from './eventos.service';
import { CompanyService } from './company.service';
import { UserSyncService } from './user-sync.service';

const { mockAddDoc, mockUpdateDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn().mockResolvedValue({ id: 'ev-1' }),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue('col'),
  collectionData: vi.fn(),
  doc: vi.fn().mockReturnValue('doc'),
  addDoc: (...a: unknown[]) => mockAddDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: () => '__ts__',
  deleteField: () => '__del__',
}));

describe('EventosService: campos de actor', () => {
  let service: EventosService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        EventosService,
        { provide: Firestore, useValue: {} },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1' }) } },
        { provide: UserSyncService, useValue: { currentUser: signal({ id: 'me' }) } },
      ],
    });
    service = TestBed.inject(EventosService);
  });

  it('createEvento escribe creadoPor y updatedBy', async () => {
    await service.createEvento({
      titulo: 'E',
      fecha: '2026-10-10',
      invitados: ['u1'],
    } as unknown as Parameters<EventosService['createEvento']>[0]);
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.creadoPor).toBe('me');
    expect(payload.updatedBy).toBe('me');
  });

  it('updateEvento escribe updatedBy', async () => {
    await service.updateEvento('ev-1', { invitados: ['u2'] });
    expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({ invitados: ['u2'], updatedBy: 'me' });
  });
});
