import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { ContactFolderService } from './contact-folder.service';
import { CompanyService } from './company.service';

const { getDocsMock } = vi.hoisted(() => ({ getDocsMock: vi.fn() }));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  serverTimestamp: () => '__serverTimestamp__',
  collection: (_fs: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
  doc: (_fs: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
  query: (...args: unknown[]) => ({ query: args }),
  where: (...args: unknown[]) => ({ where: args }),
  orderBy: (...args: unknown[]) => ({ orderBy: args }),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

const snap = (...names: string[]) => ({
  docs: names.map(name => ({ id: name, data: () => ({ name }) })),
});

/** getDocs que no resuelve hasta que el test lo decide: deja ver el estado a mitad de carga. */
function pendiente() {
  let resolver!: (v: ReturnType<typeof snap>) => void;
  getDocsMock.mockReturnValueOnce(new Promise(r => (resolver = r)));
  return (v: ReturnType<typeof snap>) => resolver(v);
}

describe('ContactFolderService.loadFolders', () => {
  let service: ContactFolderService;

  beforeEach(() => {
    getDocsMock.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u1' } } },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'co1' }) } },
      ],
    });
    service = TestBed.inject(ContactFolderService);
  });

  it('al recargar el mismo contacto conserva las carpetas mientras llega la respuesta', async () => {
    getDocsMock.mockResolvedValueOnce(snap('A'));
    await service.loadFolders('c1');

    const resolver = pendiente();
    const recarga = service.loadFolders('c1');
    expect(service.folders().map(f => f.name)).toEqual(['A']);

    resolver(snap('A', 'B'));
    await recarga;
    expect(service.folders().map(f => f.name)).toEqual(['A', 'B']);
  });

  it('al cambiar de contacto vacía las carpetas del anterior', async () => {
    getDocsMock.mockResolvedValueOnce(snap('A'));
    await service.loadFolders('c1');

    const resolver = pendiente();
    const carga = service.loadFolders('c2');
    expect(service.folders()).toEqual([]);

    resolver(snap('Z'));
    await carga;
    expect(service.folders().map(f => f.name)).toEqual(['Z']);
  });
});
