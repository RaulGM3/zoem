import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Storage } from '@angular/fire/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CupoAlmacenamientoError, AlmacenamientoCupoService } from '../planes/almacenamiento-cupo.service';
import { CasoDocService } from './caso-doc.service';
import { CompanyService } from './company.service';
import { ContactFileService } from './contact-file.service';
import { DocAuditService } from './doc-audit.service';
import { PermissionService } from './permission.service';

const m = vi.hoisted(() => ({
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock('@angular/fire/storage', () => ({
  Storage: class MockStorage {},
  ref: (_s: unknown, path: string) => ({ path }),
  uploadBytes: (...a: unknown[]) => m.uploadBytes(...a),
  getDownloadURL: (...a: unknown[]) => m.getDownloadURL(...a),
}));
vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  Timestamp: { now: () => ({}) },
  collection: (..._a: unknown[]) => ({}),
  doc: (..._a: unknown[]) => ({}),
  getDocs: vi.fn(async () => ({ docs: [] })),
  addDoc: (...a: unknown[]) => m.addDoc(...a),
  updateDoc: (...a: unknown[]) => m.updateDoc(...a),
  query: (..._a: unknown[]) => ({}),
  where: (..._a: unknown[]) => ({}),
  orderBy: (..._a: unknown[]) => ({}),
  serverTimestamp: () => 'ts',
}));

const archivo = (bytes: number, name = 'a.pdf') => new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });

/**
 * Pre-check de cupo: si el archivo no cabe NO se sube nada a Storage (sin huérfanos) y se lanza el error
 * del servicio de cupo (que ya abrió el modal de mejora).
 */
describe('subidas de archivos respetan el cupo de almacenamiento', () => {
  const asegurar = vi.fn();

  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    asegurar.mockReset();
    m.uploadBytes.mockResolvedValue(undefined);
    m.getDownloadURL.mockResolvedValue('https://x/y');
    m.addDoc.mockResolvedValue({ id: 'd1' });
    m.updateDoc.mockResolvedValue(undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: Storage, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u1' } } },
        { provide: CompanyService, useValue: { activeCompany: () => ({ id: 'c1' }) } },
        { provide: DocAuditService, useValue: { log: vi.fn() } },
        { provide: PermissionService, useValue: { isAdmin: () => true, currentMember: () => ({ nombre: 'Ana' }) } },
        { provide: AlmacenamientoCupoService, useValue: { asegurar } },
      ],
    });
  });

  describe('archivos de contacto', () => {
    it('sin espacio: no sube a Storage ni crea el doc, y propaga el error', async () => {
      asegurar.mockImplementation(() => { throw new CupoAlmacenamientoError(2); });
      const svc = TestBed.inject(ContactFileService);
      await expect(svc.uploadFile('ct1', null, archivo(5))).rejects.toBeInstanceOf(CupoAlmacenamientoError);
      expect(asegurar).toHaveBeenCalledWith(5);
      expect(m.uploadBytes).not.toHaveBeenCalled();
      expect(m.addDoc).not.toHaveBeenCalled();
    });

    it('con espacio: comprueba el tamaño del archivo y sube', async () => {
      const svc = TestBed.inject(ContactFileService);
      await svc.uploadFile('ct1', null, archivo(7));
      expect(asegurar).toHaveBeenCalledWith(7);
      expect(m.uploadBytes).toHaveBeenCalledTimes(1);
    });

    it('resubir una versión también comprueba el espacio', async () => {
      asegurar.mockImplementation(() => { throw new CupoAlmacenamientoError(0); });
      const svc = TestBed.inject(ContactFileService);
      await expect(svc.reuploadFile({ id: 'f1', contactId: 'ct1', folderId: null } as never, archivo(9))).rejects.toBeInstanceOf(CupoAlmacenamientoError);
      expect(m.uploadBytes).not.toHaveBeenCalled();
    });
  });

  describe('documentos de caso', () => {
    it('subir archivo libre sin espacio: no sube nada', async () => {
      asegurar.mockImplementation(() => { throw new CupoAlmacenamientoError(2); });
      const svc = TestBed.inject(CasoDocService);
      await expect(svc.uploadFile('k1', null, archivo(5))).rejects.toBeInstanceOf(CupoAlmacenamientoError);
      expect(m.uploadBytes).not.toHaveBeenCalled();
      expect(m.addDoc).not.toHaveBeenCalled();
    });

    it('subir a un slot, resubir y anclar plantilla también lo comprueban', async () => {
      asegurar.mockImplementation(() => { throw new CupoAlmacenamientoError(2); });
      const svc = TestBed.inject(CasoDocService);
      await expect(svc.uploadSlot('k1', { id: 's1', folderId: null } as never, archivo(5))).rejects.toBeInstanceOf(CupoAlmacenamientoError);
      await expect(svc.reuploadFile('k1', { id: 'f1', folderId: null } as never, archivo(5))).rejects.toBeInstanceOf(CupoAlmacenamientoError);
      await expect(
        svc.anclarPlantilla('k1', { name: 'X', docTemplateId: 't', folderId: null, generatedHtml: '', generatedValues: {} }, new Blob(['x'])),
      ).rejects.toBeInstanceOf(CupoAlmacenamientoError);
      expect(m.uploadBytes).not.toHaveBeenCalled();
    });

    it('con espacio sube normalmente y usa el tamaño real del archivo', async () => {
      const svc = TestBed.inject(CasoDocService);
      await svc.uploadFile('k1', null, archivo(11));
      expect(asegurar).toHaveBeenCalledWith(11);
      expect(m.uploadBytes).toHaveBeenCalledTimes(1);
    });
  });
});
