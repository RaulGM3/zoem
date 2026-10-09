import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  CasoDocumentosTabComponent,
  type CreateFolderEvent, type DocUploadEvent, type FreeUploadEvent, type ReuploadEvent,
} from './caso-documentos-tab';
import { CasoDocPreviewComponent, type PreviewDoc } from '../caso-doc-preview/caso-doc-preview';
import { CasoDocGeneradorComponent, type GeneratedDocEvent } from '../caso-doc-generador/caso-doc-generador';
import { DocHistoryPanelComponent } from '../../../../shared/components/doc-history-panel/doc-history-panel';
import { DocAccessDrawerComponent, type DocAccessState } from '../../../../shared/components/doc-access-drawer/doc-access-drawer';
import { CasoDocService } from '../../../../core/services/caso-doc.service';
import { ClassifiedUrlService } from '../../../../core/services/classified-url.service';
import { DocAuditService } from '../../../../core/services/doc-audit.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { CasoDocFile, CasoDocFolder, CasoDocSlot } from '../../../../interfaces';
import { cupoDePruebas } from '../../../../../testing/cupo-pruebas';
import type { DocVersionEntry } from '../../../../interfaces/doc-lifecycle.interface';

@Component({ selector: 'app-caso-doc-preview', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class PreviewStubComponent {
  readonly docu = input.required<PreviewDoc>();
  // El stub replica la API del componente real, que llama así a su output.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly close = output<void>();
}

@Component({ selector: 'app-caso-doc-generador', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class GeneradorStubComponent {
  readonly slot = input.required<CasoDocSlot>();
  readonly casoContext = input<Record<string, string>>({});
  readonly canEdit = input(true);
  readonly save = output<GeneratedDocEvent>();
  // El stub replica la API del componente real, que llama así a su output.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly close = output<void>();
}

@Component({ selector: 'app-doc-history-panel', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class HistoryStubComponent {
  readonly visible = input.required<boolean>();
  readonly title = input('');
  readonly versions = input<DocVersionEntry[]>([]);
  readonly parentPath = input<string | null>(null);
  readonly closed = output<void>();
}

@Component({ selector: 'app-doc-access-drawer', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class AccessStubComponent {
  readonly visible = input.required<boolean>();
  readonly mode = input('clasificado');
  readonly title = input('');
  readonly saving = input(false);
  readonly initialRestricted = input(false);
  readonly initialUserIds = input<string[]>([]);
  readonly saved = output<DocAccessState>();
  readonly closed = output<void>();
}

const FOLDERS = [
  { id: 'f1', parentId: null, name: 'Escrituras' },
  { id: 'f2', parentId: 'f1', name: 'Anexos' },
] as CasoDocFolder[];

const V1 = { version: 1 } as unknown as DocVersionEntry;

const SLOTS = [
  { id: 's1', folderId: null, name: 'DNI', description: 'Ambas caras', status: 'pendiente' },
  { id: 's2', folderId: null, name: 'Poder', status: 'pendiente', docTemplateId: 't1' },
  { id: 's3', folderId: null, name: 'Contrato', status: 'subido', version: 2, downloadUrl: 'http://x/contrato', mimeType: 'application/pdf', versions: [V1] },
  { id: 's4', folderId: 'f1', name: 'Demanda', status: 'generado', docTemplateId: 't2' },
  { id: 's5', folderId: 'f2', name: 'Nómina', status: 'pendiente' },
  { id: 's6', folderId: 'f1', name: 'Informe médico', status: 'subido', clasificado: true, storagePath: 'p/s6', mimeType: 'application/pdf', allowedUserIds: ['u9'] },
] as unknown as CasoDocSlot[];

const FILES = [
  { id: 'a1', folderId: null, name: 'nota.txt', downloadUrl: 'http://x/nota', mimeType: 'text/plain', sizeBytes: 2048, version: 1 },
  { id: 'a2', folderId: null, name: 'secreto.pdf', downloadUrl: '', mimeType: 'application/pdf', sizeBytes: 0, clasificado: true, allowedUserIds: ['u7'] },
  { id: 'a3', folderId: 'f1', name: 'plano.pdf', downloadUrl: 'http://x/plano', mimeType: 'application/pdf', sizeBytes: 3 * 1024 * 1024, version: 3, versions: [V1] },
] as unknown as CasoDocFile[];

describe('CasoDocumentosTabComponent', () => {
  let fixture: ComponentFixture<CasoDocumentosTabComponent>;
  let component: CasoDocumentosTabComponent;
  let isAdmin: ReturnType<typeof signal<boolean>>;
  let cupo: ReturnType<typeof cupoDePruebas>['cupo'];
  let limiteMB = Infinity;
  let docAudit: { log: ReturnType<typeof vi.fn> };
  let classifiedUrl: { getUrl: ReturnType<typeof vi.fn> };
  let casoDocService: {
    filePath: (casoId: string, id: string) => string;
    slotPath: (casoId: string, id: string) => string;
    setFileClassification: ReturnType<typeof vi.fn>;
    setSlotClassification: ReturnType<typeof vi.fn>;
  };
  let emitidos: {
    uploadSlot: DocUploadEvent[]; removeSlot: CasoDocSlot[]; uploadFile: FreeUploadEvent[];
    reuploadFile: ReuploadEvent[]; deleteFile: CasoDocFile[]; createFolder: CreateFolderEvent[];
    deleteFolder: string[]; generateDoc: GeneratedDocEvent[];
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
  /** Fila (carpeta, slot o archivo) del nivel actual cuyo nombre es `nombre`. */
  const fila = (nombre: string): HTMLElement => {
    const found = qa('.px-4.py-3').find(f => !f.closest('aside') && Array.from(f.querySelectorAll('.truncate')).some(t => texto(t) === nombre));
    expect(found, nombre).toBeTruthy();
    return found!;
  };
  const nombres = (): string[] =>
    qa('.px-4.py-3').filter(f => !f.closest('aside')).map(f => texto(f.querySelector('span.truncate') ?? q('p.truncate', f)));
  const migas = (): string[] => qa('nav[aria-label="Ruta de carpetas"] button').map(texto);
  const panel = (): HTMLElement | null => el().querySelector('aside[aria-label="Documentos pendientes"]');
  const stub = <T>(tipo: new () => T): T => fixture.debugElement.query(By.directive(tipo))?.componentInstance as T;

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

  function seleccionar(input: HTMLInputElement, ...files: File[]): void {
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  const archivo = (nombre: string): File => new File(['x'], nombre);

  function set(inputs: Record<string, unknown>): void {
    for (const [nombre, valor] of Object.entries(inputs)) fixture.componentRef.setInput(nombre, valor);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    isAdmin = signal(true);
    docAudit = { log: vi.fn() };
    classifiedUrl = { getUrl: vi.fn().mockResolvedValue('http://firmada') };
    casoDocService = {
      filePath: (casoId, id) => `casos/${casoId}/files/${id}`,
      slotPath: (casoId, id) => `casos/${casoId}/slots/${id}`,
      setFileClassification: vi.fn().mockResolvedValue(undefined),
      setSlotClassification: vi.fn().mockResolvedValue(undefined),
    };
    const run = async (action: () => Promise<unknown>, opts: { onSuccess?: () => void } = {}) => {
      const result = await action();
      opts.onSuccess?.();
      return result;
    };

    const prueba = cupoDePruebas({ limiteMB, usadoMB: 120 });
    cupo = prueba.cupo;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CasoDocumentosTabComponent],
      providers: [
        ...prueba.providers,
        { provide: CasoDocService, useValue: casoDocService },
        { provide: ClassifiedUrlService, useValue: classifiedUrl },
        { provide: DocAuditService, useValue: docAudit },
        { provide: PermissionService, useValue: { isAdmin } },
        { provide: ToastService, useValue: { run } },
      ],
    });
    TestBed.overrideComponent(CasoDocumentosTabComponent, {
      remove: { imports: [CasoDocPreviewComponent, CasoDocGeneradorComponent, DocHistoryPanelComponent, DocAccessDrawerComponent] },
      add: { imports: [PreviewStubComponent, GeneradorStubComponent, HistoryStubComponent, AccessStubComponent] },
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(CasoDocumentosTabComponent);
    component = fixture.componentInstance;
    emitidos = {
      uploadSlot: [], removeSlot: [], uploadFile: [], reuploadFile: [], deleteFile: [],
      createFolder: [], deleteFolder: [], generateDoc: [],
    };
    component.uploadSlot.subscribe(e => emitidos.uploadSlot.push(e));
    component.removeSlot.subscribe(e => emitidos.removeSlot.push(e));
    component.uploadFile.subscribe(e => emitidos.uploadFile.push(e));
    component.reuploadFile.subscribe(e => emitidos.reuploadFile.push(e));
    component.deleteFile.subscribe(e => emitidos.deleteFile.push(e));
    component.createFolder.subscribe(e => emitidos.createFolder.push(e));
    component.deleteFolder.subscribe(e => emitidos.deleteFolder.push(e));
    component.generateDoc.subscribe(e => emitidos.generateDoc.push(e));
    set({
      casoId: 'c1', folders: FOLDERS, slots: SLOTS, files: FILES, loading: false,
      uploadingSlotId: null, busy: false, progress: { subidos: 2, total: 6 }, casoContext: { cliente: 'Acme' },
    });
  });

  afterEach(() => vi.restoreAllMocks());

  describe('estado general', () => {
    it('muestra la carga y oculta el contenido y el panel', () => {
      set({ loading: true, folders: [], slots: [], files: [] });
      expect(el().textContent).toContain('Cargando documentos...');
      expect(qa('.px-4.py-3')).toHaveLength(0);
      expect(panel()).toBeNull();
    });

    it('muestra el progreso de los documentos requeridos', () => {
      expect(el().textContent).toContain('Documentos requeridos');
      expect(texto(q('.text-sm > .font-semibold').parentElement!)).toBe('2 de 6 completados');
      set({ progress: null });
      expect(el().textContent).not.toContain('Documentos requeridos');
    });

    it('lista carpetas, slots y archivos de la raíz, en ese orden', () => {
      expect(nombres()).toEqual(['Escrituras', 'DNI', 'Poder', 'Contrato', 'nota.txt', 'secreto.pdf']);
      expect(fila('DNI').textContent).toContain('Ambas caras');
      expect(fila('nota.txt').textContent).toContain('2.0 KB');
    });

    it('muestra el estado vacío', () => {
      set({ folders: [], slots: [], files: [] });
      expect(el().textContent).toContain('Carpeta vacía');
      expect(panel()).toBeNull();
    });

    it('sin permiso de edición ni borrado oculta las acciones de escritura', () => {
      isAdmin.set(false);
      set({ canEdit: false, canDelete: false });
      for (const etiqueta of ['Carpeta', 'Subir archivos', 'Subir carpeta', 'Clasificado', 'Subir', 'Rellenar']) {
        expect(boton(etiqueta), etiqueta).toBeUndefined();
      }
      for (const label of ['Eliminar carpeta', 'Eliminar archivo', 'Quitar documento', 'Subir nueva versión', 'Gestionar acceso']) {
        expect(qa(`[aria-label="${label}"]`), label).toHaveLength(0);
      }
      expect(qa('[aria-label="Previsualizar"]').length).toBeGreaterThan(0);
    });
  });

  describe('navegación', () => {
    it('entra en las carpetas y vuelve con las migas', async () => {
      await click(boton('Escrituras'));
      expect(migas()).toEqual(['Documentos', 'Escrituras']);
      expect(nombres()).toEqual(['Anexos', 'Demanda', 'Informe médico', 'plano.pdf']);
      await click(boton('Anexos'));
      expect(nombres()).toEqual(['Nómina']);
      await click(boton('Escrituras'));
      expect(migas()).toEqual(['Documentos', 'Escrituras']);
      await click(boton('Documentos'));
      expect(migas()).toEqual(['Documentos']);
    });

    it('al navegar descarta el alta de carpeta y las confirmaciones en curso', async () => {
      await click(boton('Carpeta'));
      await click(q('[aria-label="Eliminar archivo"]', fila('nota.txt')));
      await click(q('[aria-label="Eliminar carpeta"]', fila('Escrituras')));
      await click(boton('Escrituras'));
      await click(boton('Documentos'));
      expect(el().querySelector('[aria-label="Nombre de la nueva carpeta"]')).toBeNull();
      expect(qa('[aria-label="Confirmar borrado"]')).toHaveLength(0);
    });
  });

  describe('carpetas', () => {
    const inputNombre = (): HTMLInputElement => q('[aria-label="Nombre de la nueva carpeta"]');

    function escribir(valor: string): void {
      inputNombre().value = valor;
      inputNombre().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    it('crea una carpeta en el nivel actual', async () => {
      await click(boton('Escrituras'));
      await click(boton('Carpeta'));
      escribir('  Notariales  ');
      inputNombre().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
      fixture.detectChanges();
      expect(emitidos.createFolder).toEqual([{ parentId: 'f1', name: 'Notariales' }]);
      expect(el().querySelector('[aria-label="Nombre de la nueva carpeta"]')).toBeNull();
    });

    it('no crea carpetas sin nombre y se puede cancelar', async () => {
      await click(boton('Carpeta'));
      escribir('   ');
      await click(q('[aria-label="Crear carpeta"]'));
      expect(emitidos.createFolder).toHaveLength(0);
      inputNombre().dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));
      fixture.detectChanges();
      expect(el().querySelector('[aria-label="Nombre de la nueva carpeta"]')).toBeNull();
    });

    it('elimina una carpeta tras confirmar', async () => {
      await click(q('[aria-label="Eliminar carpeta"]', fila('Escrituras')));
      expect(fila('Escrituras').textContent).toContain('¿Borrar y todo su contenido?');
      await click(q('[aria-label="Cancelar"]', fila('Escrituras')));
      expect(emitidos.deleteFolder).toHaveLength(0);
      await click(q('[aria-label="Eliminar carpeta"]', fila('Escrituras')));
      await click(q('[aria-label="Confirmar borrado"]', fila('Escrituras')));
      expect(emitidos.deleteFolder).toEqual(['f1']);
      expect(fila('Escrituras').querySelector('[aria-label="Confirmar borrado"]')).toBeNull();
    });

    it('bloquea las acciones de la barra mientras hay una operación en curso', () => {
      set({ busy: true });
      expect(boton('Carpeta')!.disabled).toBe(true);
      expect(boton('Subir archivos')!.disabled).toBe(true);
      expect(boton('Subir carpeta')!.disabled).toBe(true);
    });
  });

  describe('slots requeridos', () => {
    it('un slot pendiente se sube eligiendo un archivo', () => {
      expect(fila('DNI').textContent).toContain('Pendiente');
      const spy = vi.spyOn(HTMLInputElement.prototype, 'click');
      boton('Subir', fila('DNI'))!.click();
      expect(spy.mock.instances[0]).toBe(q('#upload-slot-s1'));
      const file = archivo('dni.pdf');
      seleccionar(q<HTMLInputElement>('#upload-slot-s1'), file);
      expect(emitidos.uploadSlot).toEqual([{ slot: SLOTS[0], file }]);
    });

    it('marca el slot que se está subiendo', () => {
      set({ uploadingSlotId: 's1' });
      expect(boton('Subiendo...', fila('DNI'))!.disabled).toBe(true);
    });

    it('un slot con plantilla pendiente se rellena en el generador', async () => {
      expect(stub(GeneradorStubComponent)).toBeUndefined();
      await click(boton('Rellenar', fila('Poder')));
      const generador = stub(GeneradorStubComponent);
      expect(generador.slot()).toBe(SLOTS[1]);
      expect(generador.casoContext()).toEqual({ cliente: 'Acme' });
      const evento: GeneratedDocEvent = { slot: SLOTS[1], html: '<p>ok</p>', values: { a: '1' } };
      generador.save.emit(evento);
      await estable();
      expect(emitidos.generateDoc).toEqual([evento]);
      expect(stub(GeneradorStubComponent)).toBeUndefined();
    });

    it('el generador refleja el slot más reciente y se puede cerrar', async () => {
      await click(boton('Rellenar', fila('Poder')));
      const actualizado = { ...SLOTS[1], description: 'editado por otro' } as CasoDocSlot;
      set({ slots: [SLOTS[0], actualizado, ...SLOTS.slice(2)] });
      expect(stub(GeneradorStubComponent).slot()).toBe(actualizado);
      stub(GeneradorStubComponent).close.emit();
      await estable();
      expect(stub(GeneradorStubComponent)).toBeUndefined();
    });

    it('un slot generado se puede ver', async () => {
      await click(boton('Escrituras'));
      expect(fila('Demanda').textContent).toContain('Generado');
      await click(boton('Ver', fila('Demanda')));
      expect(stub(GeneradorStubComponent).slot()).toBe(SLOTS[3]);
    });

    it('un slot subido muestra su versión y se previsualiza dejando rastro', async () => {
      expect(fila('Contrato').textContent).toContain('Subido');
      expect(fila('Contrato').textContent).toContain('v2');
      await click(q('[aria-label="Previsualizar"]', fila('Contrato')));
      expect(docAudit.log).toHaveBeenCalledWith('casos/c1/slots/s3', 'view', { version: 2, detail: 'Contrato' });
      expect(stub(PreviewStubComponent).docu()).toEqual({ name: 'Contrato', downloadUrl: 'http://x/contrato', mimeType: 'application/pdf' });
      stub(PreviewStubComponent).close.emit();
      await estable();
      expect(stub(PreviewStubComponent)).toBeUndefined();
    });

    it('un slot clasificado se previsualiza con una URL firmada', async () => {
      await click(boton('Escrituras'));
      await click(q('[aria-label="Previsualizar"]', fila('Informe médico')));
      expect(classifiedUrl.getUrl).toHaveBeenCalledWith('casos/c1/slots/s6', 'view');
      expect(docAudit.log).not.toHaveBeenCalled();
      expect(stub(PreviewStubComponent).docu()).toEqual({ name: 'Informe médico', downloadUrl: 'http://firmada', mimeType: 'application/pdf' });
    });

    it('abre el historial del slot', async () => {
      await click(q('[aria-label="Ver historial"]', fila('Contrato')));
      const historial = stub(HistoryStubComponent);
      expect([historial.visible(), historial.title(), historial.versions(), historial.parentPath()])
        .toEqual([true, 'Contrato', [V1], 'casos/c1/slots/s3']);
      historial.closed.emit();
      await estable();
      expect(historial.visible()).toBe(false);
    });

    it('el admin gestiona el acceso de un slot', async () => {
      await click(boton('Escrituras'));
      await click(q('[aria-label="Gestionar acceso"]', fila('Informe médico')));
      const acceso = stub(AccessStubComponent);
      expect([acceso.visible(), acceso.title(), acceso.initialRestricted(), acceso.initialUserIds()])
        .toEqual([true, 'Informe médico', true, ['u9']]);
      acceso.saved.emit({ restricted: false, allowedRoles: [], allowedUserIds: [] });
      await estable();
      expect(casoDocService.setSlotClassification).toHaveBeenCalledWith('c1', 's6', false, []);
      expect(acceso.visible()).toBe(false);
    });

    it('quita el documento de un slot subido', async () => {
      await click(q('[aria-label="Quitar documento"]', fila('Contrato')));
      expect(emitidos.removeSlot).toEqual([SLOTS[2]]);
      set({ uploadingSlotId: 's3' });
      expect(q<HTMLButtonElement>('[aria-label="Quitar documento"]', fila('Contrato')).disabled).toBe(true);
    });
  });

  describe('archivos libres', () => {
    it('previsualiza dejando rastro en la auditoría', async () => {
      await click(q('[aria-label="Previsualizar"]', fila('nota.txt')));
      expect(docAudit.log).toHaveBeenCalledWith('casos/c1/files/a1', 'view', { version: 1, detail: 'nota.txt' });
      expect(stub(PreviewStubComponent).docu()).toEqual({ name: 'nota.txt', downloadUrl: 'http://x/nota', mimeType: 'text/plain' });
    });

    it('la descarga normal es un enlace que deja rastro', () => {
      const enlace = q<HTMLAnchorElement>('a[aria-label="Descargar"]', fila('nota.txt'));
      expect(enlace.getAttribute('href')).toBe('http://x/nota');
      enlace.addEventListener('click', e => e.preventDefault());
      enlace.click();
      expect(docAudit.log).toHaveBeenCalledWith('casos/c1/files/a1', 'download', { version: 1, detail: 'nota.txt' });
    });

    it('un clasificado se marca, y se previsualiza y descarga con URL firmada', async () => {
      expect(fila('secreto.pdf').querySelector('[aria-label="Documento clasificado"]')).not.toBeNull();
      expect(fila('secreto.pdf').querySelector('a[aria-label="Descargar"]')).toBeNull();
      await click(q('[aria-label="Previsualizar"]', fila('secreto.pdf')));
      expect(classifiedUrl.getUrl).toHaveBeenCalledWith('casos/c1/files/a2', 'view');
      expect(stub(PreviewStubComponent).docu().downloadUrl).toBe('http://firmada');

      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      await click(q('[aria-label="Descargar (documento clasificado)"]', fila('secreto.pdf')));
      expect(classifiedUrl.getUrl).toHaveBeenCalledWith('casos/c1/files/a2', 'download');
      expect(open).toHaveBeenCalledWith('http://firmada', '_blank', 'noopener');
      expect(docAudit.log).not.toHaveBeenCalled();
    });

    it('muestra versión y tamaño, y abre el historial', async () => {
      await click(boton('Escrituras'));
      expect(fila('plano.pdf').textContent).toContain('v3');
      expect(fila('plano.pdf').textContent).toContain('3.0 MB');
      await click(q('[aria-label="Ver historial"]', fila('plano.pdf')));
      const historial = stub(HistoryStubComponent);
      expect([historial.title(), historial.versions(), historial.parentPath()]).toEqual(['plano.pdf', [V1], 'casos/c1/files/a3']);
    });

    it('sube una nueva versión de un archivo', () => {
      const spy = vi.spyOn(HTMLInputElement.prototype, 'click');
      q<HTMLButtonElement>('[aria-label="Subir nueva versión"]', fila('nota.txt')).click();
      expect(spy.mock.instances[0]).toBe(q('#reupload-file-a1'));
      const newFile = archivo('nota-v2.txt');
      seleccionar(q<HTMLInputElement>('#reupload-file-a1'), newFile);
      expect(emitidos.reuploadFile).toEqual([{ file: FILES[0], newFile }]);
    });

    it('el admin gestiona el acceso de un archivo', async () => {
      await click(q('[aria-label="Gestionar acceso"]', fila('secreto.pdf')));
      const acceso = stub(AccessStubComponent);
      expect([acceso.title(), acceso.initialRestricted(), acceso.initialUserIds()]).toEqual(['secreto.pdf', true, ['u7']]);
      acceso.saved.emit({ restricted: true, allowedRoles: [], allowedUserIds: ['u7', 'u8'] });
      await estable();
      expect(casoDocService.setFileClassification).toHaveBeenCalledWith('c1', 'a2', true, ['u7', 'u8']);
      acceso.closed.emit();
      await estable();
      expect(acceso.visible()).toBe(false);
    });

    it('elimina un archivo tras confirmar, de uno en uno', async () => {
      await click(q('[aria-label="Eliminar archivo"]', fila('nota.txt')));
      await click(q('[aria-label="Eliminar archivo"]', fila('secreto.pdf')));
      expect(qa('[aria-label="Confirmar borrado"]')).toHaveLength(1);
      expect(fila('nota.txt').querySelector('[aria-label="Eliminar archivo"]')).not.toBeNull();
      await click(q('[aria-label="Cancelar"]', fila('secreto.pdf')));
      expect(emitidos.deleteFile).toHaveLength(0);
      await click(q('[aria-label="Eliminar archivo"]', fila('nota.txt')));
      await click(q('[aria-label="Confirmar borrado"]', fila('nota.txt')));
      expect(emitidos.deleteFile).toEqual([FILES[0]]);
      expect(qa('[aria-label="Confirmar borrado"]')).toHaveLength(0);
    });
  });

  describe('subida libre', () => {
    it('sube los archivos elegidos a la carpeta actual', async () => {
      await click(boton('Escrituras'));
      const spy = vi.spyOn(HTMLInputElement.prototype, 'click');
      boton('Subir archivos')!.click();
      expect(spy.mock.instances[0]).toBe(q('#upload-free'));
      const [uno, dos] = [archivo('uno.pdf'), archivo('dos.pdf')];
      seleccionar(q<HTMLInputElement>('#upload-free'), uno, dos);
      expect(emitidos.uploadFile).toEqual([
        { folderId: 'f1', file: uno, clasificado: false },
        { folderId: 'f1', file: dos, clasificado: false },
      ]);
    });

    it('sin cupo NO se abre ningún selector de archivos (ni archivos ni carpeta)', () => {
      cupo.puedeSubir.mockReturnValue(false);
      const spy = vi.spyOn(HTMLInputElement.prototype, 'click');
      boton('Subir archivos')!.click();
      boton('Subir carpeta')!.click();
      expect(spy).not.toHaveBeenCalled();
    });

    it('el salto "subir" desde el checklist tampoco abre el selector sin cupo', () => {
      cupo.puedeSubir.mockReturnValue(false);
      const spy = vi.spyOn(HTMLInputElement.prototype, 'click');
      component.triggerSlotUpload('s1');
      expect(spy).not.toHaveBeenCalled();
    });

    it('solo se suben los archivos elegidos que caben (el resto lo explica el modal)', () => {
      const [cabe, noCabe] = [archivo('cabe.pdf'), archivo('enorme.pdf')];
      cupo.admitir.mockReturnValue([cabe]);
      seleccionar(q<HTMLInputElement>('#upload-free'), cabe, noCabe);
      expect(cupo.admitir).toHaveBeenCalledWith([cabe, noCabe]);
      expect(emitidos.uploadFile.map(e => e.file)).toEqual([cabe]);
    });

    it('sube una carpeta entera aplanada', () => {
      const spy = vi.spyOn(HTMLInputElement.prototype, 'click');
      boton('Subir carpeta')!.click();
      expect(spy.mock.instances[0]).toBe(q('#upload-folder'));
      const file = archivo('dentro.pdf');
      seleccionar(q<HTMLInputElement>('#upload-folder'), file);
      expect(emitidos.uploadFile).toEqual([{ folderId: null, file, clasificado: false }]);
    });

    it('el admin puede marcar la próxima subida como clasificada, solo esa', async () => {
      await click(boton('Clasificado'));
      expect(boton('Subida clasificada')!.getAttribute('aria-pressed')).toBe('true');
      seleccionar(q<HTMLInputElement>('#upload-free'), archivo('a.pdf'));
      seleccionar(q<HTMLInputElement>('#upload-free'), archivo('b.pdf'));
      expect(emitidos.uploadFile.map(e => e.clasificado)).toEqual([true, false]);
      expect(boton('Clasificado')).toBeTruthy();
    });

    it('no emite nada si no se elige ningún archivo', () => {
      seleccionar(q<HTMLInputElement>('#upload-free'));
      expect(emitidos.uploadFile).toHaveLength(0);
    });
  });

  describe('checklist de la plantilla', () => {
    const items = (): string[] => Array.from(panel()!.querySelectorAll('button')).map(texto);

    it('lista los slots pendientes y cuenta los completados', () => {
      expect(panel()!.textContent).toContain('3 pendientes');
      expect(items()).toEqual(['DNI', 'Poder', 'Nómina']);
      expect(panel()!.textContent).toContain('3 completados');
    });

    it('usa el singular y el estado completo', () => {
      set({ slots: [SLOTS[0], SLOTS[2]] });
      expect(panel()!.textContent).toContain('1 pendiente');
      expect(panel()!.textContent).not.toContain('1 pendientes');
      expect(panel()!.textContent).toContain('1 completado');
      expect(panel()!.textContent).not.toContain('1 completados');
      set({ slots: [SLOTS[2]] });
      expect(panel()!.textContent).toContain('✓ Completo');
      expect(panel()!.textContent).toContain('Todos los documentos requeridos están completados.');
    });

    it('saltar a un slot con plantilla navega a su carpeta y abre el generador', async () => {
      await click(boton('Escrituras'));
      await click(boton('Poder', panel()!));
      expect(migas()).toEqual(['Documentos']);
      expect(stub(GeneradorStubComponent).slot()).toBe(SLOTS[1]);
    });

    it('saltar a un slot de subida navega a su carpeta y abre el selector de archivo', async () => {
      vi.useFakeTimers();
      try {
        const spy = vi.spyOn(HTMLInputElement.prototype, 'click');
        boton('Nómina', panel()!)!.click();
        fixture.detectChanges();
        expect(migas()).toEqual(['Documentos', 'Escrituras', 'Anexos']);
        expect(spy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(50);
        expect(spy.mock.instances[0]).toBe(q('#upload-slot-s5'));
      } finally {
        vi.useRealTimers();
      }
    });

    it('se bloquea mientras hay una operación en curso', () => {
      set({ busy: true });
      expect(Array.from(panel()!.querySelectorAll('button')).every(b => b.disabled)).toBe(true);
    });
  });

  describe('medidor de almacenamiento', () => {
    it('la sección de documentos incluye el medidor (se pinta solo con plan de límite finito)', () => {
      expect(el().querySelector('app-almacenamiento-medidor')).not.toBeNull();
      expect(el().querySelector('app-almacenamiento-medidor [data-estado]')).toBeNull(); // plan ilimitado en este test
    });
  });
});
