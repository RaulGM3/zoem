import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PlantillaDocumentosTabComponent } from './plantilla-documentos-tab';
import { ToastService } from '../../../../core/services/toast.service';
import { PlantillaFolderService } from '../../../../core/services/plantilla-folder.service';
import { PlantillaFileService } from '../../../../core/services/plantilla-file.service';
import { DocTemplateService } from '../../../../core/services/doc-template.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { UsersService } from '../../../../core/services/users';
import { DocAccessDrawerComponent } from '../../../../shared/components/doc-access-drawer/doc-access-drawer';
import type { CompanyMember, DocTemplate, PlantillaFile, PlantillaFolder } from '../../../../interfaces';

interface RunOptions { successMessage?: string; errorTitle?: string; onSuccess?: () => void }

const FOLDERS = [
  { id: 'f1', plantillaId: 'p1', parentId: null, name: 'Identidad' },
  { id: 'f2', plantillaId: 'p1', parentId: 'f1', name: 'Poderes' },
] as PlantillaFolder[];

const FILES = [
  { id: 'd1', plantillaId: 'p1', folderId: null, name: 'DNI.pdf' },
  { id: 'd2', plantillaId: 'p1', folderId: 'f1', name: 'Poder.pdf', docTemplateId: 't1' },
  { id: 'd3', plantillaId: 'p1', folderId: 'f2', name: 'Escritura.pdf', visibleTo: 'restricted' },
] as PlantillaFile[];

const TEMPLATES = [
  { id: 't1', name: 'Poder general', variables: ['a', 'b'] },
  { id: 't2', name: 'Demanda tipo', variables: [] },
] as unknown as DocTemplate[];

describe('PlantillaDocumentosTabComponent', () => {
  let fixture: ComponentFixture<PlantillaDocumentosTabComponent>;
  let isAdmin: ReturnType<typeof signal<boolean>>;
  let run: ReturnType<typeof vi.fn>;
  let folderService: {
    folders: ReturnType<typeof signal<PlantillaFolder[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    createFolder: ReturnType<typeof vi.fn>;
    updateFolder: ReturnType<typeof vi.fn>;
    deleteFolder: ReturnType<typeof vi.fn>;
  };
  let fileService: {
    files: ReturnType<typeof signal<PlantillaFile[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    addFile: ReturnType<typeof vi.fn>;
    deleteFile: ReturnType<typeof vi.fn>;
    linkTemplate: ReturnType<typeof vi.fn>;
    setVisibility: ReturnType<typeof vi.fn>;
  };

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(selector: string): T => {
    const found = el().querySelector<T>(selector);
    expect(found, selector).toBeTruthy();
    return found!;
  };
  const qa = <T extends HTMLElement>(selector: string): T[] => Array.from(el().querySelectorAll<T>(selector));
  const boton = (texto: string, raiz: HTMLElement = el()): HTMLButtonElement | undefined =>
    Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.trim() === texto);
  const textos = (selector: string): string[] => qa(selector).map(e => e.textContent?.trim() ?? '');

  async function estable(): Promise<void> {
    fixture.detectChanges();
    // Deja correr las promesas encadenadas (toast.run) antes de repintar.
    await new Promise(resolve => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function click(target: HTMLElement | undefined | null): Promise<void> {
    expect(target).toBeTruthy();
    target!.click();
    await estable();
  }

  function escribir(selector: string, valor: string): HTMLInputElement {
    const control = q<HTMLInputElement>(selector);
    control.value = valor;
    control.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return control;
  }

  async function tecla(control: HTMLElement, key: string): Promise<void> {
    control.dispatchEvent(new KeyboardEvent('keyup', { key }));
    await estable();
  }

  beforeEach(async () => {
    isAdmin = signal(true);
    run = vi.fn(async (action: () => Promise<unknown>, opts: RunOptions = {}) => {
      const result = await action();
      opts.onSuccess?.();
      return result;
    });
    folderService = {
      folders: signal<PlantillaFolder[]>(FOLDERS),
      isLoading: signal(false),
      createFolder: vi.fn().mockResolvedValue(undefined),
      updateFolder: vi.fn().mockResolvedValue(undefined),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
    };
    fileService = {
      files: signal<PlantillaFile[]>(FILES),
      isLoading: signal(false),
      addFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      linkTemplate: vi.fn().mockResolvedValue(undefined),
      setVisibility: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PlantillaDocumentosTabComponent],
      providers: [
        { provide: ToastService, useValue: { run } },
        { provide: PlantillaFolderService, useValue: folderService },
        { provide: PlantillaFileService, useValue: fileService },
        { provide: DocTemplateService, useValue: { templates: signal(TEMPLATES) } },
        { provide: PermissionService, useValue: { isAdmin } },
        { provide: UsersService, useValue: { members: signal<CompanyMember[]>([]), loadMembers: vi.fn().mockResolvedValue(undefined) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlantillaDocumentosTabComponent);
    fixture.componentRef.setInput('plantillaId', 'p1');
    await estable();
  });

  const lista = (): HTMLElement => q('ul.divide-y');
  const fila = (nombre: string): HTMLElement => {
    const li = Array.from(lista().querySelectorAll<HTMLElement>(':scope > li')).find(l => l.textContent?.includes(nombre));
    expect(li, nombre).toBeTruthy();
    return li!;
  };
  const nombresVisibles = (): string[] =>
    Array.from(lista().querySelectorAll<HTMLElement>(':scope > li')).map(li => (li.querySelector('span.truncate, p')?.textContent ?? '').trim());
  const migas = (): string[] => textos('nav[aria-label="Ruta de carpetas"] button').filter(Boolean);
  const dialogoVincular = (): HTMLElement | null => el().querySelector('[role="dialog"][aria-labelledby="link-template-title"]');

  it('muestra carpetas y documentos de la raíz', () => {
    expect(nombresVisibles()).toEqual(['Identidad', 'DNI.pdf']);
    expect(migas()).toEqual(['Raíz']);
  });

  it('muestra el estado de carga', async () => {
    folderService.isLoading.set(true);
    await estable();
    expect(el().textContent).toContain('Cargando...');
  });

  it('muestra el estado vacío', async () => {
    folderService.folders.set([]);
    fileService.files.set([]);
    await estable();
    expect(el().textContent).toContain('Crea carpetas o añade nombres de documentos requeridos');
  });

  it('navega por las carpetas con las migas', async () => {
    await click(boton('Identidad', lista()));
    expect(nombresVisibles()).toEqual(['Poderes', 'Poder.pdf']);
    await click(boton('Poderes', lista()));
    expect(nombresVisibles()).toEqual(['Escritura.pdf']);
    expect(migas()).toEqual(['Raíz', 'Identidad', 'Poderes']);

    await click(q('[aria-label="Carpeta anterior"]'));
    expect(migas()).toEqual(['Raíz', 'Identidad']);
    await click(boton('Poderes', lista()));
    await click(boton('Identidad', q('nav[aria-label="Ruta de carpetas"]')));
    expect(nombresVisibles()).toEqual(['Poderes', 'Poder.pdf']);
    await click(boton('Raíz'));
    expect(nombresVisibles()).toEqual(['Identidad', 'DNI.pdf']);
    expect(el().querySelector('[aria-label="Carpeta anterior"]')).toBeNull();
  });

  it('crea una carpeta en la carpeta actual', async () => {
    await click(boton('Identidad', lista()));
    await click(boton('Carpeta'));
    const input = escribir('input[placeholder="Nombre de la carpeta"]', '  Anexos  ');
    await tecla(input, 'Enter');
    expect(folderService.createFolder).toHaveBeenCalledWith({ plantillaId: 'p1', parentId: 'f1', name: 'Anexos' });
    expect(el().querySelector('input[placeholder="Nombre de la carpeta"]')).toBeNull();
  });

  it('no crea carpetas sin nombre y Escape cierra el formulario', async () => {
    await click(boton('Carpeta'));
    const input = escribir('input[placeholder="Nombre de la carpeta"]', '   ');
    await tecla(input, 'Enter');
    expect(folderService.createFolder).not.toHaveBeenCalled();
    await tecla(input, 'Escape');
    expect(el().querySelector('input[placeholder="Nombre de la carpeta"]')).toBeNull();
  });

  it('añade un documento y alterna entre los dos formularios', async () => {
    await click(boton('Carpeta'));
    await click(boton('Documento'));
    expect(el().querySelector('input[placeholder="Nombre de la carpeta"]')).toBeNull();
    const input = escribir('input[placeholder^="Nombre del documento"]', 'Libro de familia.pdf');
    await tecla(input, 'Enter');
    expect(fileService.addFile).toHaveBeenCalledWith('p1', null, 'Libro de familia.pdf');
    expect(el().querySelector('input[placeholder^="Nombre del documento"]')).toBeNull();
  });

  it('renombra una carpeta', async () => {
    await click(fila('Identidad').querySelector<HTMLButtonElement>('[title="Renombrar"]'));
    const input = fila('').querySelector<HTMLInputElement>('input')!;
    expect(input.value).toBe('Identidad');
    input.value = ' Identificación ';
    input.dispatchEvent(new Event('input'));
    await tecla(input, 'Enter');
    expect(folderService.updateFolder).toHaveBeenCalledWith('f1', { name: 'Identificación' }, 'p1');
    expect(lista().querySelector('input')).toBeNull();
  });

  it('elimina una carpeta con todo su contenido tras confirmar', async () => {
    await click(fila('Identidad').querySelector<HTMLButtonElement>('[title="Eliminar"]'));
    expect(fila('Identidad').textContent).toContain('¿Eliminar "Identidad" y su contenido?');
    expect(folderService.deleteFolder).not.toHaveBeenCalled();
    await click(boton('Eliminar', fila('Identidad')));
    expect(fileService.deleteFile.mock.calls).toEqual([['d3', 'p1'], ['d2', 'p1']]);
    expect(folderService.deleteFolder.mock.calls).toEqual([['f2'], ['f1']]);
    expect(run.mock.calls[0][1]).toMatchObject({ successMessage: 'Carpeta eliminada' });
  });

  it('cancelar no elimina la carpeta', async () => {
    await click(fila('Identidad').querySelector<HTMLButtonElement>('[title="Eliminar"]'));
    await click(boton('Cancelar', fila('Identidad')));
    expect(folderService.deleteFolder).not.toHaveBeenCalled();
    expect(boton('Identidad', lista())).toBeTruthy();
  });

  it('elimina un documento tras confirmar', async () => {
    await click(fila('DNI.pdf').querySelector<HTMLButtonElement>('[title="Eliminar"]'));
    expect(fileService.deleteFile).not.toHaveBeenCalled();
    await click(boton('Eliminar', fila('DNI.pdf')));
    expect(fileService.deleteFile).toHaveBeenCalledWith('d1', 'p1');
  });

  it('vincula una plantilla de documento buscándola en el selector', async () => {
    await click(fila('DNI.pdf').querySelector<HTMLButtonElement>('[title="Vincular plantilla de documento"]'));
    expect(textos('[role="dialog"] li button span.truncate')).toEqual(['Poder general', 'Demanda tipo']);
    expect(dialogoVincular()!.textContent).toContain('2 variables');
    escribir('input[placeholder="Buscar plantilla..."]', 'DEMANDA');
    expect(textos('[role="dialog"] li button span.truncate')).toEqual(['Demanda tipo']);
    await click(dialogoVincular()!.querySelector<HTMLButtonElement>('li button'));
    expect(fileService.linkTemplate).toHaveBeenCalledWith('d1', 't2');
    expect(dialogoVincular()).toBeNull();
  });

  it('el selector avisa si no hay plantillas que coincidan y se cierra con el fondo', async () => {
    await click(fila('DNI.pdf').querySelector<HTMLButtonElement>('[title="Vincular plantilla de documento"]'));
    escribir('input[placeholder="Buscar plantilla..."]', 'zzz');
    expect(dialogoVincular()!.textContent).toContain('No hay plantillas de documentos');
    await click(dialogoVincular());
    expect(dialogoVincular()).toBeNull();
    expect(fileService.linkTemplate).not.toHaveBeenCalled();
  });

  it('muestra la plantilla vinculada y permite desvincularla', async () => {
    await click(boton('Identidad', lista()));
    expect(fila('Poder.pdf').textContent).toContain('Poder general');
    expect(fila('Poder.pdf').querySelector('[title="Vincular plantilla de documento"]')).toBeNull();
    await click(fila('Poder.pdf').querySelector<HTMLButtonElement>('[title="Desvincular plantilla de documento"]'));
    expect(fileService.linkTemplate).toHaveBeenCalledWith('d2', null);
  });

  it('marca los documentos con visibilidad restringida', async () => {
    await click(boton('Identidad', lista()));
    await click(boton('Poderes', lista()));
    expect(fila('Escritura.pdf').querySelector('[aria-label="Visibilidad restringida"]')).not.toBeNull();
  });

  it('el admin cambia la visibilidad de un documento', async () => {
    await click(fila('DNI.pdf').querySelector<HTMLButtonElement>('[title="Quién puede ver esta plantilla"]'));
    const drawer = fixture.debugElement.query(By.directive(DocAccessDrawerComponent)).componentInstance as DocAccessDrawerComponent;
    expect(drawer.visible()).toBe(true);
    expect(drawer.title()).toBe('DNI.pdf');
    drawer.saved.emit({ restricted: true, allowedRoles: ['Admin'], allowedUserIds: ['u2'] });
    await estable();
    expect(fileService.setVisibility).toHaveBeenCalledWith('d1', 'restricted', ['Admin'], ['u2']);
    expect(drawer.visible()).toBe(false);
  });

  it('quien no es admin no puede cambiar la visibilidad', async () => {
    isAdmin.set(false);
    await estable();
    expect(fila('DNI.pdf').querySelector('[title="Quién puede ver esta plantilla"]')).toBeNull();
  });
});
