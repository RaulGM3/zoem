import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ContactoDocumentosComponent } from './contacto-documentos';
import { ContactFolderService } from '../../../../core/services/contact-folder.service';
import { ContactFileService } from '../../../../core/services/contact-file.service';
import { UploadQueueService } from '../../../../core/services/upload-queue.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { ContactFile, ContactFolder } from '../../../../interfaces';

const FOLDERS = [{ id: 'f1', contactId: 'c1', parentId: null, name: 'Identidad' }] as ContactFolder[];
const FILES = [
  { id: 'd1', contactId: 'c1', folderId: null, name: 'dni.pdf', mimeType: 'application/pdf', sizeBytes: 2048, storagePath: 'p/d1', downloadUrl: 'http://x/d1' },
  { id: 'd2', contactId: 'c1', folderId: null, name: 'foto.png', mimeType: 'image/png', sizeBytes: 512, storagePath: 'p/d2', downloadUrl: 'http://x/d2' },
] as unknown as ContactFile[];

function mockViewport(mobile: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: mobile && /max-width/.test(q),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

describe('ContactoDocumentosComponent — móvil', () => {
  let fixture: ComponentFixture<ContactoDocumentosComponent>;
  let denegados: Set<string>;
  let deleteFile: ReturnType<typeof vi.fn>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function estable(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function montar(mobile: boolean): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    deleteFile = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [ContactoDocumentosComponent],
      providers: [
        { provide: ContactFolderService, useValue: { folders: signal(FOLDERS), isLoading: signal(false), updateFolder: vi.fn(), deleteFolder: vi.fn(), createFolder: vi.fn() } },
        { provide: ContactFileService, useValue: { files: signal(FILES), isLoading: signal(false), deleteFile, uploadFile: vi.fn() } },
        { provide: UploadQueueService, useValue: { enqueue: vi.fn() } },
        { provide: PermissionService, useValue: { can: (m: string, c: string) => !denegados.has(`${m}:${c}`) } },
        { provide: ToastService, useValue: { run: vi.fn(async (a: () => Promise<unknown>, o: { onSuccess?: () => void } = {}) => { await a(); o.onSuccess?.(); }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ContactoDocumentosComponent);
    fixture.componentRef.setInput('contactId', 'c1');
    await estable();
  }

  beforeEach(() => {
    denegados = new Set();
    TestBed.resetTestingModule();
  });

  it('móvil: cada archivo es una tarjeta con menú de acciones', async () => {
    await montar(true);
    const filas = el().querySelectorAll('ul > li');
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('dni.pdf');
    expect(filas[0].querySelector('app-action-menu')).not.toBeNull();
  });

  it('móvil: las acciones del archivo ya no dependen del hover', async () => {
    await montar(true);
    expect(el().querySelector('ul .group-hover\\:opacity-100')).toBeNull();
  });

  it('móvil: las carpetas tienen menú de acciones en lugar de botones al pasar el ratón', async () => {
    await montar(true);
    expect(el().querySelectorAll('[data-carpeta] app-action-menu')).toHaveLength(1);
  });

  it('escritorio: lista de archivos sin tarjetas ni menús', async () => {
    await montar(false);
    expect(el().querySelector('ul > li')).toBeNull();
    expect(el().querySelector('app-action-menu')).toBeNull();
    expect(el().querySelector('[aria-label="Descargar dni.pdf"]')).not.toBeNull();
  });

  it('móvil: eliminar desde el menú pide confirmación y luego borra', async () => {
    await montar(true);
    el().querySelector<HTMLButtonElement>('ul button[aria-haspopup="menu"]')!.click();
    await estable();
    el().querySelector<HTMLButtonElement>('[data-action-id="delete"]')!.click();
    await estable();
    expect(el().textContent).toContain('¿Eliminar "dni.pdf"?');
    const confirmar = Array.from(el().querySelectorAll('ul button')).find((b) => b.textContent?.trim() === 'Eliminar')!;
    (confirmar as HTMLButtonElement).click();
    await estable();
    expect(deleteFile).toHaveBeenCalledWith('d1', 'p/d1', 'c1');
  });

  describe('acciones (misma lógica de permisos que escritorio)', () => {
    const ids = (f: 'archivo' | 'carpeta'): string[] =>
      (f === 'archivo' ? fixture.componentInstance.accionesArchivo() : fixture.componentInstance.accionesCarpeta()).map((a) => a.id);

    it('archivo: descargar y eliminar con todos los permisos', async () => {
      await montar(false);
      expect(ids('archivo')).toEqual(['download', 'delete']);
    });

    it('archivo: sin permiso de eliminar solo descargar', async () => {
      denegados.add('Contactos:eliminar');
      await montar(false);
      expect(ids('archivo')).toEqual(['download']);
    });

    it('carpeta: renombrar y eliminar con todos los permisos', async () => {
      await montar(false);
      expect(ids('carpeta')).toEqual(['rename', 'delete']);
    });

    it('carpeta: sin permisos no hay acciones', async () => {
      denegados.add('Contactos:editar');
      denegados.add('Contactos:eliminar');
      await montar(false);
      expect(ids('carpeta')).toEqual([]);
    });
  });
});
