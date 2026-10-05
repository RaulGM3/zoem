import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { PlantillaDetailComponent } from './plantilla-detail';
import { PlantillasService } from '../../core/services/plantillas.service';
import { ToastService } from '../../core/services/toast.service';
import { PlantillaFolderService } from '../../core/services/plantilla-folder.service';
import { PlantillaFileService } from '../../core/services/plantilla-file.service';
import { DocTemplateService } from '../../core/services/doc-template.service';
import { AccionesService } from '../../core/services/acciones.service';
import { PermissionService } from '../../core/services/permission.service';
import { UsersService } from '../../core/services/users';
import type {
  CasoPlantilla, CompanyMember, DocTemplate, PlantillaFile, PlantillaFolder,
} from '../../interfaces';

interface RunOptions { successMessage?: string; errorTitle?: string; onSuccess?: () => void }

const ANA = { id: 'm1', userId: 'u1', nombre: 'Ana', apellido: 'García' } as CompanyMember;
const LUIS = { id: 'm2', userId: 'u2', nombre: 'Luis' } as CompanyMember;

function plantilla(): CasoPlantilla {
  return {
    id: 'p1',
    companyId: 'c1',
    nombre: 'Divorcio contencioso',
    descripcion: 'Procedimiento completo',
    tipo: 'Civil',
    hitos: [
      { id: 'h2', titulo: 'Juicio', diasDesdeInicio: 30, orden: 1 },
      { id: 'h1', titulo: 'Demanda', diasDesdeInicio: 5, asignadoA: 'u1', orden: 0 },
    ],
    modeloCostos: {
      honorariosBase: 1500,
      suplidos: [
        { nombre: 'Tasa judicial', tipo: 'suplido', importeEstimado: 50 },
        { nombre: 'Procurador', tipo: 'gastos_repercutibles' },
      ],
    },
  } as CasoPlantilla;
}

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

describe('PlantillaDetailComponent', () => {
  let fixture: ComponentFixture<PlantillaDetailComponent>;
  let members: ReturnType<typeof signal<CompanyMember[]>>;
  let isAdmin: ReturnType<typeof signal<boolean>>;
  let routeId: string | null;
  let getPlantilla: ReturnType<typeof vi.fn>;
  let updatePlantilla: ReturnType<typeof vi.fn>;
  let run: ReturnType<typeof vi.fn>;
  let folderService: {
    folders: ReturnType<typeof signal<PlantillaFolder[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    loadFolders: ReturnType<typeof vi.fn>;
    createFolder: ReturnType<typeof vi.fn>;
    updateFolder: ReturnType<typeof vi.fn>;
    deleteFolder: ReturnType<typeof vi.fn>;
  };
  let fileService: {
    files: ReturnType<typeof signal<PlantillaFile[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    loadFiles: ReturnType<typeof vi.fn>;
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

  async function estable(): Promise<void> {
    fixture.detectChanges();
    // Deja correr las promesas encadenadas (ngOnInit, toast.run) antes de repintar.
    await new Promise(resolve => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function click(target: HTMLElement | undefined | null): Promise<void> {
    expect(target).toBeTruthy();
    target!.click();
    await estable();
  }

  async function tab(label: string): Promise<void> {
    await click(qa<HTMLButtonElement>('[role="tab"]').find(b => b.textContent?.trim() === label));
  }

  function escribir(selector: string, valor: string, evento: 'input' | 'change' = 'input'): HTMLInputElement {
    const control = q<HTMLInputElement>(selector);
    control.value = valor;
    control.dispatchEvent(new Event(evento));
    fixture.detectChanges();
    return control;
  }

  async function crear(): Promise<void> {
    fixture = TestBed.createComponent(PlantillaDetailComponent);
    await estable();
  }

  beforeEach(async () => {
    members = signal<CompanyMember[]>([ANA, LUIS]);
    isAdmin = signal(true);
    routeId = 'p1';
    getPlantilla = vi.fn().mockResolvedValue(plantilla());
    updatePlantilla = vi.fn().mockResolvedValue(undefined);
    run = vi.fn(async (action: () => Promise<unknown>, opts: RunOptions = {}) => {
      const result = await action();
      opts.onSuccess?.();
      return result;
    });
    folderService = {
      folders: signal<PlantillaFolder[]>(FOLDERS),
      isLoading: signal(false),
      loadFolders: vi.fn().mockResolvedValue(undefined),
      createFolder: vi.fn().mockResolvedValue(undefined),
      updateFolder: vi.fn().mockResolvedValue(undefined),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
    };
    fileService = {
      files: signal<PlantillaFile[]>(FILES),
      isLoading: signal(false),
      loadFiles: vi.fn().mockResolvedValue(undefined),
      addFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      linkTemplate: vi.fn().mockResolvedValue(undefined),
      setVisibility: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PlantillaDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => routeId } } } },
        { provide: PlantillasService, useValue: { getPlantilla, updatePlantilla } },
        { provide: ToastService, useValue: { run } },
        { provide: PlantillaFolderService, useValue: folderService },
        { provide: PlantillaFileService, useValue: fileService },
        { provide: DocTemplateService, useValue: { templates: signal(TEMPLATES), loadTemplates: vi.fn().mockResolvedValue(undefined) } },
        { provide: PermissionService, useValue: { isAdmin, can: () => true } },
        { provide: AccionesService, useValue: { listarPorPlantilla: vi.fn().mockResolvedValue([]) } },
        { provide: UsersService, useValue: { members, loadMembers: vi.fn().mockResolvedValue(undefined) } },
      ],
    }).compileComponents();
  });

  describe('carga', () => {
    it('vuelve al listado si la ruta no trae id', async () => {
      routeId = null;
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await crear();
      expect(navigate).toHaveBeenCalledWith(['/plantillas']);
      expect(getPlantilla).not.toHaveBeenCalled();
    });

    it('vuelve al listado si la plantilla no existe', async () => {
      getPlantilla.mockResolvedValue(null);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await crear();
      expect(navigate).toHaveBeenCalledWith(['/plantillas']);
    });

    it('muestra la cabecera y carga carpetas y archivos de la plantilla', async () => {
      await crear();
      expect(q('h1').textContent).toContain('Divorcio contencioso');
      expect(q('h1').nextElementSibling!.textContent).toContain('Civil');
      expect(folderService.loadFolders).toHaveBeenCalledWith('p1');
      expect(fileService.loadFiles).toHaveBeenCalledWith('p1');
    });

    it('abre en la pestaña de datos básicos', async () => {
      await crear();
      expect(qa('[role="tab"]').map(t => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    });
  });

  describe('datos básicos', () => {
    it('rellena el formulario con la plantilla', async () => {
      await crear();
      expect(q<HTMLInputElement>('#pd-nombre').value).toBe('Divorcio contencioso');
      expect(q<HTMLSelectElement>('#pd-tipo').value).toBe('Civil');
      expect(q<HTMLTextAreaElement>('#pd-desc').value).toBe('Procedimiento completo');
    });

    it('no deja guardar sin nombre', async () => {
      await crear();
      escribir('#pd-nombre', '   ');
      expect(boton('Guardar cambios')!.disabled).toBe(true);
    });

    it('guarda los datos recortados y actualiza la cabecera', async () => {
      await crear();
      escribir('#pd-nombre', '  Divorcio express  ');
      escribir('#pd-desc', '');
      escribir('#pd-tipo', '', 'change');
      await click(boton('Guardar cambios'));
      expect(updatePlantilla).toHaveBeenCalledWith('p1', {
        nombre: 'Divorcio express', descripcion: undefined, tipo: undefined,
      });
      expect(run.mock.calls[0][1]).toMatchObject({ successMessage: 'Datos guardados' });
      expect(q('h1').textContent).toContain('Divorcio express');
    });
  });

  describe('pestañas', () => {
    const paneles = (): HTMLElement[] =>
      ['app-plantilla-hitos-tab', 'app-plantilla-costos-tab', 'app-plantilla-documentos-tab', 'app-plantilla-acciones-tab'].map(sel => q(sel));

    it('solo muestra el contenido de la pestaña activa', async () => {
      await crear();
      expect(el().querySelector('#pd-nombre')).not.toBeNull();
      expect(paneles().map(p => p.hidden)).toEqual([true, true, true, true]);

      await tab('Hitos');
      expect(el().querySelector('#pd-nombre')).toBeNull();
      expect(paneles().map(p => p.hidden)).toEqual([false, true, true, true]);
      expect(qa('[role="tab"]').map(t => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false', 'false']);

      await tab('Estructura de costos');
      expect(paneles().map(p => p.hidden)).toEqual([true, false, true, true]);

      await tab('Documentos de referencia');
      expect(paneles().map(p => p.hidden)).toEqual([true, true, false, true]);

      await tab('Acciones');
      expect(paneles().map(p => p.hidden)).toEqual([true, true, true, false]);
    });
  });

  describe('hitos', () => {
    const filas = (): HTMLElement[] => qa('app-plantilla-hitos-tab li[draggable="true"]');
    const titulos = (): string[] => filas().map(li => li.querySelector('p')!.textContent!.trim());
    const hitosGuardados = () => updatePlantilla.mock.calls[0][1].hitos as { titulo: string; orden: number; asignadoA?: string }[];

    it('carga los hitos de la plantilla ordenados y con el nombre del asignado', async () => {
      await crear();
      await tab('Hitos');
      expect(titulos()).toEqual(['Demanda', 'Juicio']);
      expect(filas()[0].textContent).toContain('Ana García');
    });

    it('guarda los hitos editados en la pestaña', async () => {
      await crear();
      await tab('Hitos');
      escribir('#h-titulo', 'Sentencia');
      await click(boton('+ Añadir hito'));
      await click(boton('Guardar hitos'));
      expect(updatePlantilla).toHaveBeenCalledTimes(1);
      expect(updatePlantilla.mock.calls[0][0]).toBe('p1');
      expect(hitosGuardados().map(h => [h.titulo, h.orden])).toEqual([['Demanda', 0], ['Juicio', 1], ['Sentencia', 2]]);
      expect(run.mock.calls[0][1]).toMatchObject({ successMessage: 'Hitos guardados' });
    });

    it('conserva los cambios sin guardar y el borrador al cambiar de pestaña', async () => {
      await crear();
      await tab('Hitos');
      escribir('#h-titulo', 'Sentencia');
      await click(boton('+ Añadir hito'));
      escribir('#h-titulo', 'Borrador');
      await tab('Datos básicos');
      await tab('Hitos');
      expect(titulos()).toEqual(['Demanda', 'Juicio', 'Sentencia']);
      expect(q<HTMLInputElement>('#h-titulo').value).toBe('Borrador');
    });

    it('con un único miembro en el despacho le asigna los hitos nuevos', async () => {
      members.set([ANA]);
      await crear();
      await tab('Hitos');
      expect(el().querySelector('#h-asignado')).toBeNull();
      escribir('#h-titulo', 'Sentencia');
      await click(boton('+ Añadir hito'));
      await click(boton('Guardar hitos'));
      expect(hitosGuardados()[2]).toMatchObject({ titulo: 'Sentencia', asignadoA: 'u1' });
    });
  });

  describe('estructura de costos', () => {
    const filas = (): HTMLElement[] => qa('app-plantilla-costos-tab li[draggable="true"]');
    const nombres = (): string[] => filas().map(li => li.querySelector('p')!.textContent!.trim());
    const modeloGuardado = () => updatePlantilla.mock.calls[0][1].modeloCostos;

    beforeEach(async () => {
      await crear();
      await tab('Estructura de costos');
    });

    it('carga los honorarios y las partidas de la plantilla', () => {
      expect(q<HTMLInputElement>('#pd-honorarios').value).toBe('1500');
      expect(nombres()).toEqual(['Tasa judicial', 'Procurador']);
    });

    it('guarda honorarios y partidas editados en la pestaña', async () => {
      escribir('#pd-honorarios', '2000.5');
      escribir('#s-nombre', 'Peritaje');
      escribir('#s-tipo', 'costas_judiciales', 'change');
      await click(boton('+ Añadir partida'));
      await click(boton('Guardar costos'));
      expect(updatePlantilla.mock.calls[0][0]).toBe('p1');
      expect(modeloGuardado()).toEqual({
        honorariosBase: 2000.5,
        suplidos: [
          { nombre: 'Tasa judicial', tipo: 'suplido', importeEstimado: 50 },
          { nombre: 'Procurador', tipo: 'gastos_repercutibles' },
          { nombre: 'Peritaje', tipo: 'costas_judiciales' },
        ],
      });
      expect(run.mock.calls[0][1]).toMatchObject({ successMessage: 'Costos guardados' });
    });

    it('guarda los honorarios vacíos como indefinidos', async () => {
      escribir('#pd-honorarios', '');
      await click(boton('Guardar costos'));
      expect(modeloGuardado().honorariosBase).toBeUndefined();
    });

    it('conserva los cambios sin guardar al cambiar de pestaña', async () => {
      escribir('#pd-honorarios', '999');
      await click(filas()[0].querySelector<HTMLButtonElement>('[aria-label="Eliminar partida"]'));
      await tab('Hitos');
      await tab('Estructura de costos');
      expect(q<HTMLInputElement>('#pd-honorarios').value).toBe('999');
      expect(nombres()).toEqual(['Procurador']);
    });
  });

  describe('documentos de referencia', () => {
    it('muestra el árbol de la plantilla y opera sobre su id', async () => {
      await crear();
      await tab('Documentos de referencia');
      expect(q('app-plantilla-documentos-tab').textContent).toContain('Identidad');
      await click(boton('Carpeta'));
      const input = escribir('input[placeholder="Nombre de la carpeta"]', 'Anexos');
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
      await estable();
      expect(folderService.createFolder).toHaveBeenCalledWith({ plantillaId: 'p1', parentId: null, name: 'Anexos' });
    });
  });
});
