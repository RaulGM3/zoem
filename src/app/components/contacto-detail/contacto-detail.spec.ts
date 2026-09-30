import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ContactoDetailComponent } from './contacto-detail';
import {
  EstadoContactoDialogComponent, type CambioEstadoResult,
} from '../../shared/components/estado-contacto-dialog/estado-contacto-dialog';
import { ContactService } from '../../core/services/contact.service';
import { ContactFolderService } from '../../core/services/contact-folder.service';
import { ContactFileService } from '../../core/services/contact-file.service';
import { UploadQueueService } from '../../core/services/upload-queue.service';
import { CasosService } from '../../core/services/casos.service';
import { EventosService } from '../../core/services/eventos.service';
import { SeguimientoContactoService } from '../../core/services/seguimiento-contacto.service';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import type { Caso, CompanyMember, Contact, ContactFile, ContactFolder, Evento } from '../../interfaces';

interface RunOptions { successMessage?: string; errorTitle?: string; onSuccess?: () => void }

@Component({ selector: 'app-estado-contacto-dialog', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class EstadoDialogStubComponent {
  readonly contacto = input.required<Contact>();
  readonly soloSeguimiento = input(false);
  readonly closed = output<void>();
  readonly saved = output<CambioEstadoResult>();
}

const ANA = {
  id: 'c1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'López', email: 'ana@example.com',
  status: 'activo', notes: 'Cliente VIP',
} as unknown as Contact;

const FOLDERS = [
  { id: 'f1', contactId: 'c1', parentId: null, name: 'Identidad' },
  { id: 'f2', contactId: 'c1', parentId: 'f1', name: 'Poderes' },
] as ContactFolder[];

const FILES = [
  { id: 'd1', contactId: 'c1', folderId: null, name: 'dni.pdf', mimeType: 'application/pdf', sizeBytes: 2048, storagePath: 'p/d1', downloadUrl: 'http://x/d1' },
  { id: 'd2', contactId: 'c1', folderId: 'f1', name: 'foto.png', mimeType: 'image/png', sizeBytes: 512, storagePath: 'p/d2', downloadUrl: 'http://x/d2' },
  { id: 'd3', contactId: 'c1', folderId: 'f2', name: 'poder.docx', mimeType: 'application/msword', sizeBytes: 3 * 1024 * 1024, storagePath: 'p/d3', downloadUrl: 'http://x/d3' },
] as unknown as ContactFile[];

describe('ContactoDetailComponent', () => {
  let fixture: ComponentFixture<ContactoDetailComponent>;
  let denegados: Set<string>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let run: ReturnType<typeof vi.fn>;
  let getContact: ReturnType<typeof vi.fn>;
  let updateContact: ReturnType<typeof vi.fn>;
  let folderService: {
    folders: ReturnType<typeof signal<ContactFolder[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    loadFolders: ReturnType<typeof vi.fn>;
    createFolder: ReturnType<typeof vi.fn>;
    updateFolder: ReturnType<typeof vi.fn>;
    deleteFolder: ReturnType<typeof vi.fn>;
  };
  let fileService: {
    files: ReturnType<typeof signal<ContactFile[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    loadFiles: ReturnType<typeof vi.fn>;
    uploadFile: ReturnType<typeof vi.fn>;
    deleteFile: ReturnType<typeof vi.fn>;
  };

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(selector: string, raiz: HTMLElement = el()): T => {
    const found = raiz.querySelector<T>(selector);
    expect(found, selector).toBeTruthy();
    return found!;
  };
  const qa = <T extends HTMLElement>(selector: string): T[] => Array.from(el().querySelectorAll<T>(selector));
  const texto = (e: Element): string => e.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const boton = (etiqueta: string, raiz: HTMLElement = el()): HTMLButtonElement | undefined =>
    Array.from(raiz.querySelectorAll('button')).find(b => texto(b) === etiqueta);

  async function estable(): Promise<void> {
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function click(target: HTMLElement | undefined | null): Promise<void> {
    expect(target).toBeTruthy();
    target!.click();
    await estable();
  }

  async function crear(id = 'c1'): Promise<void> {
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ContactoDetailComponent);
    fixture.componentRef.setInput('id', id);
    await estable();
  }

  beforeEach(async () => {
    denegados = new Set();
    run = vi.fn(async (action: () => Promise<unknown>, opts: RunOptions = {}) => {
      try {
        const result = await action();
        opts.onSuccess?.();
        return result;
      } catch {
        return undefined;
      }
    });
    getContact = vi.fn().mockResolvedValue(ANA);
    updateContact = vi.fn().mockResolvedValue(undefined);
    folderService = {
      folders: signal<ContactFolder[]>(FOLDERS),
      isLoading: signal(false),
      loadFolders: vi.fn().mockResolvedValue(undefined),
      createFolder: vi.fn().mockResolvedValue(undefined),
      updateFolder: vi.fn().mockResolvedValue(undefined),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
    };
    fileService = {
      files: signal<ContactFile[]>(FILES),
      isLoading: signal(false),
      loadFiles: vi.fn().mockResolvedValue(undefined),
      uploadFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ContactoDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ContactService, useValue: { getContact, updateContact } },
        { provide: ContactFolderService, useValue: folderService },
        { provide: ContactFileService, useValue: fileService },
        { provide: UploadQueueService, useValue: { enqueue: vi.fn() } },
        { provide: CasosService, useValue: { casos: signal<Caso[]>([]), loadCasos: vi.fn().mockResolvedValue(undefined) } },
        { provide: EventosService, useValue: { eventos: signal<Evento[]>([]), loadEventos: vi.fn().mockResolvedValue(undefined), updateEvento: vi.fn() } },
        { provide: SeguimientoContactoService, useValue: { cambiarEstado: vi.fn().mockResolvedValue(undefined) } },
        { provide: UsersService, useValue: { members: signal<CompanyMember[]>([]), loadMembers: vi.fn().mockResolvedValue(undefined) } },
        {
          provide: PermissionService,
          useValue: {
            can: (modulo: string, cap: string) => !denegados.has(`${modulo}:${cap}`),
            currentMember: () => null, userRole: () => null, isSuperUser: () => false,
          },
        },
        { provide: ToastService, useValue: { run } },
      ],
    });
    TestBed.overrideComponent(ContactoDetailComponent, {
      remove: { imports: [EstadoContactoDialogComponent] },
      add: { imports: [EstadoDialogStubComponent] },
    });
    await TestBed.compileComponents();
  });

  describe('ficha', () => {
    it('carga el contacto con sus carpetas y archivos', async () => {
      await crear();
      expect(getContact).toHaveBeenCalledWith('c1');
      expect(folderService.loadFolders).toHaveBeenCalledWith('c1');
      expect(fileService.loadFiles).toHaveBeenCalledWith('c1');
      expect(texto(q('h1'))).toBe('Ana López');
      expect(q<HTMLTextAreaElement>('[aria-label="Notas del contacto"]').value).toBe('Cliente VIP');
    });

    it('avisa si el contacto no existe y permite volver', async () => {
      getContact.mockResolvedValue(null);
      await crear();
      expect(el().textContent).toContain('Contacto no encontrado.');
      await click(boton('Volver a contactos'));
      expect(navigate).toHaveBeenCalledWith(['/contactos']);
    });

    it('el botón Editar lleva al listado con la intención de edición', async () => {
      await crear();
      await click(boton('Editar'));
      expect(navigate).toHaveBeenCalledWith(['/contactos'], { queryParams: { editContact: 'c1' } });
    });
  });

  describe('documentos', () => {
    it('muestra el explorador de documentos del contacto', async () => {
      await crear();
      const seccion = q('app-contacto-documentos');
      expect(texto(q('h3', seccion))).toBe('Documentos (3)');
      expect(seccion.querySelector('[aria-label="Abrir carpeta Identidad"]')).not.toBeNull();
    });
  });

  describe('cambio de contacto', () => {
    it('al cambiar de contacto recarga sus datos y vuelve a la raíz de documentos', async () => {
      await crear();
      await click(q('[aria-label="Abrir carpeta Identidad"]'));
      expect(qa('nav[aria-label="Ruta de carpetas"] button')).toHaveLength(2);
      fixture.componentRef.setInput('id', 'c2');
      await estable();
      expect(getContact).toHaveBeenCalledWith('c2');
      expect(folderService.loadFolders).toHaveBeenCalledWith('c2');
      expect(qa('nav[aria-label="Ruta de carpetas"] button')).toHaveLength(0);
    });
  });
});
