import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactoDocumentosComponent } from './contacto-documentos';
import { ContactFolderService } from '../../../../core/services/contact-folder.service';
import { ContactFileService } from '../../../../core/services/contact-file.service';
import { UploadQueueService } from '../../../../core/services/upload-queue.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { ContactFile, ContactFolder } from '../../../../interfaces';
import { cupoDePruebas } from '../../../../../testing/cupo-pruebas';

interface RunOptions { successMessage?: string; errorTitle?: string; onSuccess?: () => void }

const FOLDERS = [
  { id: 'f1', contactId: 'c1', parentId: null, name: 'Identidad' },
  { id: 'f2', contactId: 'c1', parentId: 'f1', name: 'Poderes' },
] as ContactFolder[];

const FILES = [
  { id: 'd1', contactId: 'c1', folderId: null, name: 'dni.pdf', mimeType: 'application/pdf', sizeBytes: 2048, storagePath: 'p/d1', downloadUrl: 'http://x/d1' },
  { id: 'd2', contactId: 'c1', folderId: 'f1', name: 'foto.png', mimeType: 'image/png', sizeBytes: 512, storagePath: 'p/d2', downloadUrl: 'http://x/d2' },
  { id: 'd3', contactId: 'c1', folderId: 'f2', name: 'poder.docx', mimeType: 'application/msword', sizeBytes: 3 * 1024 * 1024, storagePath: 'p/d3', downloadUrl: 'http://x/d3' },
] as unknown as ContactFile[];

describe('ContactoDocumentosComponent', () => {
  let fixture: ComponentFixture<ContactoDocumentosComponent>;
  let denegados: Set<string>;
  let enqueue: ReturnType<typeof vi.fn>;
  let cupo: ReturnType<typeof cupoDePruebas>['cupo'];
  let folderService: {
    folders: ReturnType<typeof signal<ContactFolder[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    createFolder: ReturnType<typeof vi.fn>;
    updateFolder: ReturnType<typeof vi.fn>;
    deleteFolder: ReturnType<typeof vi.fn>;
  };
  let fileService: {
    files: ReturnType<typeof signal<ContactFile[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    uploadFile: ReturnType<typeof vi.fn>;
    deleteFile: ReturnType<typeof vi.fn>;
  };

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(selector: string, raiz: HTMLElement = el()): T => {
    const found = raiz.querySelector<T>(selector);
    expect(found, selector).toBeTruthy();
    return found!;
  };
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

  async function montar(): Promise<void> {
    fixture = TestBed.createComponent(ContactoDocumentosComponent);
    fixture.componentRef.setInput('contactId', 'c1');
    await estable();
  }

  beforeEach(async () => {
    denegados = new Set();
    const run = async (action: () => Promise<unknown>, opts: RunOptions = {}) => {
      try {
        const result = await action();
        opts.onSuccess?.();
        return result;
      } catch {
        return undefined;
      }
    };
    enqueue = vi.fn();
    const prueba = cupoDePruebas();
    cupo = prueba.cupo;
    folderService = {
      folders: signal<ContactFolder[]>(FOLDERS),
      isLoading: signal(false),
      createFolder: vi.fn().mockResolvedValue(undefined),
      updateFolder: vi.fn().mockResolvedValue(undefined),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
    };
    fileService = {
      files: signal<ContactFile[]>(FILES),
      isLoading: signal(false),
      uploadFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ContactoDocumentosComponent],
      providers: [
        ...prueba.providers,
        { provide: ContactFolderService, useValue: folderService },
        { provide: ContactFileService, useValue: fileService },
        { provide: UploadQueueService, useValue: { enqueue } },
        { provide: PermissionService, useValue: { can: (modulo: string, cap: string) => !denegados.has(`${modulo}:${cap}`) } },
        { provide: ToastService, useValue: { run } },
      ],
    }).compileComponents();
  });

  const seccion = (): HTMLElement => el();
  const carpetas = (): string[] => Array.from(seccion().querySelectorAll('[aria-label^="Abrir carpeta"]')).map(texto);
  const archivos = (): string[] => Array.from(seccion().querySelectorAll('p.text-sm.font-medium.truncate')).map(texto);
  const migas = (): string[] => Array.from(seccion().querySelectorAll('nav[aria-label="Ruta de carpetas"] button')).map(texto);
  const tarjeta = (nombre: string): HTMLElement => q<HTMLElement>(`[aria-label="Abrir carpeta ${nombre}"]`, seccion()).closest<HTMLElement>('.group')!;
  const filaArchivo = (nombre: string): HTMLElement => {
    const p = Array.from(seccion().querySelectorAll('p')).find(e => texto(e).includes(nombre));
    expect(p, nombre).toBeTruthy();
    return p!.closest<HTMLElement>('.rounded-lg')!;
  };

  function escribir(label: string, valor: string): HTMLInputElement {
    const input = q<HTMLInputElement>(`input[aria-label="${label}"]`, seccion());
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return input;
  }

  async function tecla(control: HTMLElement, key: string): Promise<void> {
    control.dispatchEvent(new KeyboardEvent('keydown', { key }));
    await estable();
  }

  it('muestra el total y el contenido de la raíz', async () => {
    await montar();
    expect(texto(q('h3', seccion()))).toBe('Documentos (3)');
    expect(carpetas()).toEqual(['Identidad']);
    expect(archivos()).toEqual(['dni.pdf']);
    expect(filaArchivo('dni.pdf').textContent).toContain('2.0 KB');
    expect(filaArchivo('dni.pdf').textContent).toContain('📄');
    expect(migas()).toEqual([]);
  });

  it('muestra el estado de carga y el vacío', async () => {
    folderService.folders.set([]);
    fileService.files.set([]);
    folderService.isLoading.set(true);
    await montar();
    expect(seccion().textContent).toContain('Cargando documentos...');
    folderService.isLoading.set(false);
    folderService.folders.set([]);
    fileService.files.set([]);
    await estable();
    expect(seccion().textContent).toContain('Esta carpeta está vacía');
  });

  it('navega por las carpetas con las migas', async () => {
    await montar();
    await click(q('[aria-label="Abrir carpeta Identidad"]', seccion()));
    expect(migas()).toEqual(['Raíz', 'Identidad']);
    expect(carpetas()).toEqual(['Poderes']);
    expect(archivos()).toEqual(['foto.png']);
    expect(filaArchivo('foto.png').textContent).toContain('512 B');
    expect(filaArchivo('foto.png').textContent).toContain('🖼️');
    await click(q('[aria-label="Abrir carpeta Poderes"]', seccion()));
    expect(filaArchivo('poder.docx').textContent).toContain('3.0 MB');
    expect(filaArchivo('poder.docx').textContent).toContain('📝');
    await click(boton('Identidad', seccion()));
    expect(migas()).toEqual(['Raíz', 'Identidad']);
    await click(boton('Raíz', seccion()));
    expect(carpetas()).toEqual(['Identidad']);
  });

  it('crea una carpeta en la carpeta actual', async () => {
    await montar();
    await click(q('[aria-label="Abrir carpeta Identidad"]', seccion()));
    await click(boton('Nueva carpeta', seccion()));
    await tecla(escribir('Nombre de la nueva carpeta', '  Anexos  '), 'Enter');
    expect(folderService.createFolder).toHaveBeenCalledWith({ contactId: 'c1', parentId: 'f1', name: 'Anexos' });
    expect(seccion().querySelector('[aria-label="Nombre de la nueva carpeta"]')).toBeNull();
  });

  it('no crea carpetas sin nombre; Escape y Cancelar descartan el borrador', async () => {
    await montar();
    await click(boton('Nueva carpeta', seccion()));
    expect(q<HTMLButtonElement>('[aria-label="Crear carpeta"]', seccion()).disabled).toBe(true);
    await tecla(escribir('Nombre de la nueva carpeta', 'Borrador'), 'Escape');
    expect(folderService.createFolder).not.toHaveBeenCalled();
    await click(boton('Nueva carpeta', seccion()));
    expect(q<HTMLInputElement>('[aria-label="Nombre de la nueva carpeta"]', seccion()).value).toBe('');
    escribir('Nombre de la nueva carpeta', 'Otro');
    await click(q('[aria-label="Cancelar"]', seccion()));
    expect(seccion().querySelector('[aria-label="Nombre de la nueva carpeta"]')).toBeNull();
  });

  it('renombra una carpeta', async () => {
    await montar();
    await click(q('[aria-label="Renombrar carpeta"]', tarjeta('Identidad')));
    const input = q<HTMLInputElement>('[aria-label="Nuevo nombre de carpeta"]', seccion());
    expect(input.value).toBe('Identidad');
    await tecla(escribir('Nuevo nombre de carpeta', ' Identificación '), 'Enter');
    expect(folderService.updateFolder).toHaveBeenCalledWith('f1', { name: 'Identificación' }, 'c1');
    expect(seccion().querySelector('[aria-label="Nuevo nombre de carpeta"]')).toBeNull();
  });

  it('elimina una carpeta con todo su contenido tras confirmar', async () => {
    await montar();
    await click(q('[aria-label="Eliminar carpeta"]', tarjeta('Identidad')));
    expect(seccion().textContent).toContain('¿Eliminar "Identidad"?');
    await click(boton('Cancelar', seccion()));
    expect(folderService.deleteFolder).not.toHaveBeenCalled();
    await click(q('[aria-label="Eliminar carpeta"]', tarjeta('Identidad')));
    await click(boton('Eliminar', seccion()));
    expect(fileService.deleteFile.mock.calls).toEqual([['d3', 'p/d3', 'c1'], ['d2', 'p/d2', 'c1']]);
    expect(folderService.deleteFolder.mock.calls).toEqual([['f2'], ['f1']]);
  });

  it('encola la subida de cada archivo elegido en la carpeta actual', async () => {
    await montar();
    await click(q('[aria-label="Abrir carpeta Identidad"]', seccion()));
    const input = q<HTMLInputElement>('input[type="file"]', seccion());
    const [uno, dos] = [new File(['x'], 'uno.pdf'), new File(['x'], 'dos.pdf')];
    Object.defineProperty(input, 'files', { value: [uno, dos], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls[0].slice(1)).toEqual([
      'uno.pdf', { successMessage: '"uno.pdf" subido', errorTitle: 'No se pudo subir el archivo' },
    ]);
    await enqueue.mock.calls[1][0]();
    expect(fileService.uploadFile).toHaveBeenCalledWith('c1', 'f1', dos);
  });

  it('sin cupo el selector de archivos no se abre (se cancela el click) y no se encola nada', async () => {
    cupo.puedeSubir.mockReturnValue(false);
    await montar();
    const input = q<HTMLInputElement>('input[type="file"]', seccion());
    const click = new MouseEvent('click', { cancelable: true, bubbles: true });
    input.dispatchEvent(click);
    expect(cupo.puedeSubir).toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(true);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('con cupo el click abre el selector con normalidad', async () => {
    await montar();
    const click = new MouseEvent('click', { cancelable: true, bubbles: true });
    q<HTMLInputElement>('input[type="file"]', seccion()).dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it('solo se encolan los archivos elegidos que caben en el cupo', async () => {
    await montar();
    const input = q<HTMLInputElement>('input[type="file"]', seccion());
    const [cabe, noCabe] = [new File(['x'], 'cabe.pdf'), new File(['x'], 'enorme.pdf')];
    cupo.admitir.mockReturnValue([cabe]);
    Object.defineProperty(input, 'files', { value: [cabe, noCabe], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(cupo.admitir).toHaveBeenCalledWith([cabe, noCabe]);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][1]).toBe('cabe.pdf');
  });

  it('muestra el medidor de almacenamiento en la cabecera de documentos', async () => {
    await montar();
    expect(seccion().querySelector('app-almacenamiento-medidor')).not.toBeNull();
  });

  it('descarga y elimina un archivo tras confirmar', async () => {
    await montar();
    expect(q<HTMLAnchorElement>('[aria-label="Descargar dni.pdf"]', seccion()).getAttribute('href')).toBe('http://x/d1');
    await click(q('[aria-label="Eliminar dni.pdf"]', seccion()));
    expect(seccion().textContent).toContain('¿Eliminar "dni.pdf"?');
    await click(boton('Cancelar', seccion()));
    expect(fileService.deleteFile).not.toHaveBeenCalled();
    await click(q('[aria-label="Eliminar dni.pdf"]', seccion()));
    await click(boton('Eliminar', seccion()));
    expect(fileService.deleteFile).toHaveBeenCalledWith('d1', 'p/d1', 'c1');
  });

  it('oculta las acciones para las que no hay permiso', async () => {
    denegados = new Set(['Contactos:crear', 'Contactos:editar', 'Contactos:eliminar']);
    await montar();
    expect(boton('Nueva carpeta', seccion())).toBeUndefined();
    expect(seccion().querySelector('input[type="file"]')).toBeNull();
    for (const label of ['Renombrar carpeta', 'Eliminar carpeta', 'Eliminar dni.pdf']) {
      expect(seccion().querySelector(`[aria-label="${label}"]`), label).toBeNull();
    }
    expect(seccion().querySelector('[aria-label="Descargar dni.pdf"]')).not.toBeNull();
  });

  it('si falla el renombrado la carpeta sigue en edición', async () => {
    folderService.updateFolder.mockRejectedValue(new Error('sin red'));
    await montar();
    await click(q('[aria-label="Renombrar carpeta"]', tarjeta('Identidad')));
    await tecla(escribir('Nuevo nombre de carpeta', 'Otra'), 'Enter');
    expect(el().querySelector('[aria-label="Nuevo nombre de carpeta"]')).not.toBeNull();
  });

  it('al cambiar de contacto vuelve a la raíz', async () => {
    await montar();
    await click(q('[aria-label="Abrir carpeta Identidad"]'));
    expect(migas()).toEqual(['Raíz', 'Identidad']);
    fixture.componentRef.setInput('contactId', 'c2');
    await estable();
    expect(migas()).toEqual([]);
  });
});
