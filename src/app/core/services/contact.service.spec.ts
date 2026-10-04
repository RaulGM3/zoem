import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { ContactService } from './contact.service';
import { CompanyService } from './company.service';
import { ActividadService } from './actividad.service';
import { PermissionService } from './permission.service';

const { mockAddDoc, mockUpdateDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn().mockResolvedValue({ id: 'ct-1' }),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue('col'),
  doc: vi.fn().mockReturnValue('doc'),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: (...a: unknown[]) => mockAddDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: () => '__ts__',
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: { now: () => 'now' },
}));

describe('ContactService: campos de actor', () => {
  let service: ContactService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ContactService,
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'me' } } },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1' }) } },
        { provide: ActividadService, useValue: { log: vi.fn().mockResolvedValue(undefined) } },
        { provide: PermissionService, useValue: {} },
      ],
    });
    service = TestBed.inject(ContactService);
  });

  it('createContact escribe createdBy y updatedBy', async () => {
    await service.createContact({
      type: 'persona_fisica',
      nombre: 'Ana',
      apellidos: 'Ruiz',
      assignedTo: 'u1',
    } as unknown as Parameters<ContactService['createContact']>[0]);
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.createdBy).toBe('me');
    expect(payload.updatedBy).toBe('me');
    expect(payload.assignedTo).toBe('u1');
  });

  it('updateContact escribe updatedBy', async () => {
    await service.updateContact('ct-1', { assignedTo: 'u2' });
    expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({ assignedTo: 'u2', updatedBy: 'me' });
  });
});
