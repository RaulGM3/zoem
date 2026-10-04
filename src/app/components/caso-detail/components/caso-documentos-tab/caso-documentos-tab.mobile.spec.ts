import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CasoDocumentosTabComponent } from './caso-documentos-tab';
import { CasoDocPreviewComponent } from '../caso-doc-preview/caso-doc-preview';
import { CasoDocGeneradorComponent } from '../caso-doc-generador/caso-doc-generador';
import { DocHistoryPanelComponent } from '../../../../shared/components/doc-history-panel/doc-history-panel';
import { DocAccessDrawerComponent } from '../../../../shared/components/doc-access-drawer/doc-access-drawer';
import { CasoDocService } from '../../../../core/services/caso-doc.service';
import { ClassifiedUrlService } from '../../../../core/services/classified-url.service';
import { DocAuditService } from '../../../../core/services/doc-audit.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { CasoDocFile, CasoDocFolder, CasoDocSlot } from '../../../../interfaces';
import { mockViewport } from '../../mock-viewport';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

@Component({ selector: 'app-caso-doc-preview', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class PreviewStub { readonly docu = input<unknown>(); readonly close = output<void>(); }
@Component({ selector: 'app-caso-doc-generador', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class GeneradorStub { readonly slot = input<unknown>(); readonly casoContext = input<unknown>(); readonly canEdit = input(true); readonly save = output<unknown>(); readonly close = output<void>(); }
@Component({ selector: 'app-doc-history-panel', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class HistoryStub { readonly visible = input(false); readonly title = input(''); readonly versions = input<unknown[]>([]); readonly parentPath = input<string | null>(null); readonly closed = output<void>(); }
@Component({ selector: 'app-doc-access-drawer', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class AccessStub { readonly visible = input(false); readonly mode = input(''); readonly title = input(''); readonly saving = input(false); readonly initialRestricted = input(false); readonly initialUserIds = input<string[]>([]); readonly saved = output<unknown>(); readonly closed = output<void>(); }

const FOLDERS = [{ id: 'f1', parentId: null, name: 'Escrituras' }] as CasoDocFolder[];
const SLOTS = [
  { id: 's1', folderId: null, name: 'DNI', status: 'pendiente' },
  { id: 's3', folderId: null, name: 'Contrato', status: 'subido', downloadUrl: 'http://x/c', mimeType: 'application/pdf' },
] as unknown as CasoDocSlot[];
const FILES = [
  { id: 'a1', folderId: null, name: 'nota.txt', downloadUrl: 'http://x/nota', mimeType: 'text/plain', sizeBytes: 2048, version: 1 },
] as unknown as CasoDocFile[];

describe('CasoDocumentosTabComponent — móvil', () => {
  let fixture: ComponentFixture<CasoDocumentosTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({
      imports: [CasoDocumentosTabComponent],
      providers: [
        { provide: CasoDocService, useValue: {} },
        { provide: ClassifiedUrlService, useValue: {} },
        { provide: DocAuditService, useValue: { log: vi.fn() } },
        { provide: PermissionService, useValue: { isAdmin: signal(true) } },
        { provide: ToastService, useValue: { run: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(CasoDocumentosTabComponent, {
      remove: { imports: [CasoDocPreviewComponent, CasoDocGeneradorComponent, DocHistoryPanelComponent, DocAccessDrawerComponent] },
      add: { imports: [PreviewStub, GeneradorStub, HistoryStub, AccessStub] },
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(CasoDocumentosTabComponent);
    const set = (k: string, v: unknown): void => fixture.componentRef.setInput(k, v);
    set('casoId', 'c1');
    set('folders', FOLDERS);
    set('slots', SLOTS);
    set('files', FILES);
    set('loading', false);
    set('uploadingSlotId', null);
    set('busy', false);
    set('progress', { subidos: 1, total: 2 });
    set('casoContext', {});
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('el contenedor apila columna principal y checklist en móvil y las pone en fila desde sm', async () => {
    await montar(true);
    const raiz = el().firstElementChild!;
    expect(raiz.classList.contains('flex-col')).toBe(true);
    expect(raiz.classList.contains('sm:flex-row')).toBe(true);
  });

  it('el checklist ocupa todo el ancho en móvil y 18rem desde sm', async () => {
    await montar(true);
    const aside = el().querySelector('aside')!;
    expect(aside.classList.contains('w-full')).toBe(true);
    expect(aside.classList.contains('sm:w-72')).toBe(true);
  });

  it('móvil: slot subido y archivo usan menú de acciones', async () => {
    await montar(true);
    expect(el().querySelectorAll('button[aria-haspopup="menu"]')).toHaveLength(2);
  });

  it('el botón de eliminar carpeta es visible sin hover en móvil', async () => {
    await montar(true);
    const del = el().querySelector<HTMLButtonElement>('button[aria-label="Eliminar carpeta"]')!;
    expect(del.classList.contains('opacity-0')).toBe(false);
    expect(del.classList.contains('sm:opacity-0')).toBe(true);
    expect(del.classList.contains('tap-target')).toBe(true);
  });

  it('la barra de acciones envuelve en móvil', async () => {
    await montar(true);
    const nav = el().querySelector('nav[aria-label="Ruta de carpetas"]')!;
    expect(nav.nextElementSibling!.classList.contains('flex-wrap')).toBe(true);
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
