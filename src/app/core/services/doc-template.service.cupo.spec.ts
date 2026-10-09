import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Storage } from '@angular/fire/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlmacenamientoCupoService, CupoAlmacenamientoError } from '../planes/almacenamiento-cupo.service';
import { CompanyService } from './company.service';
import { DocAuditService } from './doc-audit.service';
import { DocTemplateService } from './doc-template.service';
import { ErrorService } from './error.service';
import { PermissionService } from './permission.service';

const m = vi.hoisted(() => ({ uploadBytes: vi.fn(), uploadString: vi.fn(), getDownloadURL: vi.fn(), setDoc: vi.fn() }));

vi.mock('@angular/fire/storage', () => ({
  Storage: class MockStorage {},
  ref: (_s: unknown, path: string) => ({ path }),
  uploadBytes: (...a: unknown[]) => m.uploadBytes(...a),
  uploadString: (...a: unknown[]) => m.uploadString(...a),
  getDownloadURL: (...a: unknown[]) => m.getDownloadURL(...a),
}));
vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: () => ({}),
  doc: () => ({ id: 't1' }),
  getDoc: vi.fn(),
  getDocs: vi.fn(async () => ({ docs: [] })),
  setDoc: (...a: unknown[]) => m.setDoc(...a),
  updateDoc: vi.fn(),
  runTransaction: vi.fn(),
  query: () => ({}),
  orderBy: () => ({}),
  serverTimestamp: () => 'ts',
}));

const fuente = (bytes: number) => new File([new Uint8Array(bytes)], 'plantilla.docx');

/** La fuente (.pdf/.docx) de una plantilla de documento es almacenamiento de la empresa: cuenta en el cupo. */
describe('DocTemplateService.createTemplate · cupo de almacenamiento', () => {
  const asegurar = vi.fn();

  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    asegurar.mockReset();
    m.uploadBytes.mockResolvedValue(undefined);
    m.getDownloadURL.mockResolvedValue('https://x/y');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: Storage, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u1' } } },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1' }) } },
        { provide: DocAuditService, useValue: { log: vi.fn() } },
        { provide: ErrorService, useValue: { report: vi.fn(), log: vi.fn(), handle: vi.fn() } },
        { provide: PermissionService, useValue: { currentMember: () => ({ nombre: 'Ana' }), userRole: () => 'Admin', isSuperUser: () => false } },
        { provide: AlmacenamientoCupoService, useValue: { asegurar } },
      ],
    });
  });

  it('sin espacio para la fuente: no sube nada ni crea la plantilla', async () => {
    asegurar.mockImplementation(() => { throw new CupoAlmacenamientoError(0, 9); });
    await expect(TestBed.inject(DocTemplateService).createTemplate({ name: 'P', html: '<p/>', variables: [], sourceFile: fuente(9) }))
      .rejects.toBeInstanceOf(CupoAlmacenamientoError);
    expect(asegurar).toHaveBeenCalledWith(9);
    expect(m.uploadBytes).not.toHaveBeenCalled();
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('con espacio: sube la fuente y guarda su tamaño (sourceSizeBytes) para el contador', async () => {
    await TestBed.inject(DocTemplateService).createTemplate({ name: 'P', html: '<p/>', variables: [], sourceFile: fuente(9) });
    expect(m.uploadBytes).toHaveBeenCalledTimes(1);
    expect(m.setDoc.mock.calls[0][1]).toMatchObject({ sourceSizeBytes: 9 });
  });

  it('sin archivo fuente no consulta el cupo ni guarda tamaño', async () => {
    await TestBed.inject(DocTemplateService).createTemplate({ name: 'P', html: '<p/>', variables: [] });
    expect(asegurar).not.toHaveBeenCalled();
    expect(m.setDoc.mock.calls[0][1]).not.toHaveProperty('sourceSizeBytes');
  });
});
