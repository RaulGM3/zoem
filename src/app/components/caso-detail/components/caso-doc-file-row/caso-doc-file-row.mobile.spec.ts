import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CasoDocFileRowComponent } from './caso-doc-file-row';
import type { CasoDocFile } from '../../../../interfaces';
import { mockViewport } from '../../mock-viewport';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const file = (extra: Record<string, unknown> = {}): CasoDocFile =>
  ({ id: 'a1', folderId: null, name: 'nota.txt', downloadUrl: 'http://x/nota', mimeType: 'text/plain', sizeBytes: 2048, ...extra }) as unknown as CasoDocFile;

describe('CasoDocFileRowComponent — móvil', () => {
  let fixture: ComponentFixture<CasoDocFileRowComponent>;
  let eventos: string[];
  const el = (): HTMLElement => fixture.nativeElement;
  const ids = (): string[] => fixture.componentInstance.acciones().map((a) => a.id);

  async function montar(mobile: boolean, f: CasoDocFile, inputs: Record<string, unknown> = {}): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [CasoDocFileRowComponent] });
    fixture = TestBed.createComponent(CasoDocFileRowComponent);
    const c = fixture.componentInstance;
    eventos = [];
    c.preview.subscribe(() => eventos.push('preview'));
    c.downloadClassified.subscribe(() => eventos.push('downloadClassified'));
    c.history.subscribe(() => eventos.push('history'));
    c.access.subscribe(() => eventos.push('access'));
    c.deleteRequested.subscribe(() => eventos.push('deleteRequested'));
    fixture.componentRef.setInput('file', f);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    await fixture.whenStable();
  }

  async function elegir(id: string): Promise<void> {
    el().querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    el().querySelector<HTMLButtonElement>(`[data-action-id="${id}"]`)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('acciones: archivo normal con todos los permisos', async () => {
    await montar(true, file(), { isAdmin: true });
    expect(ids()).toEqual(['preview', 'reupload', 'history', 'access', 'delete']);
  });

  it('acciones: sin permisos de edición/borrado/admin', async () => {
    await montar(true, file(), { canEdit: false, canDelete: false });
    expect(ids()).toEqual(['preview', 'history']);
  });

  it('acciones: clasificado añade la descarga protegida', async () => {
    await montar(true, file({ clasificado: true }), { canEdit: false, canDelete: false });
    expect(ids()).toEqual(['preview', 'downloadClassified', 'history']);
  });

  it('móvil: la descarga directa sigue siendo un enlace visible y el resto va en el menú', async () => {
    await montar(true, file(), { isAdmin: true });
    expect(el().querySelector('a[aria-label="Descargar"]')).not.toBeNull();
    expect(el().querySelectorAll('button[aria-haspopup="menu"]')).toHaveLength(1);
    expect(el().querySelector('button[aria-label="Previsualizar"]')).toBeNull();
  });

  it('móvil: elegir acciones emite los mismos outputs que escritorio', async () => {
    await montar(true, file({ clasificado: true }), { isAdmin: true });
    for (const id of ['preview', 'history', 'access', 'delete', 'downloadClassified']) await elegir(id);
    expect(eventos).toEqual(['preview', 'history', 'access', 'deleteRequested', 'downloadClassified']);
  });

  it('móvil: pidiendo confirmación se muestran confirmar/cancelar con área táctil', async () => {
    await montar(true, file(), { confirmingDelete: true });
    expect(el().querySelector('button[aria-label="Confirmar borrado"]')).not.toBeNull();
    expect(el().querySelector('button[aria-label="Cancelar"]')!.classList.contains('max-sm:tap-target')).toBe(true);
    expect(el().querySelector('button[aria-haspopup="menu"]')).toBeNull();
  });

  it('escritorio: iconos inline, sin menú', async () => {
    await montar(false, file(), { isAdmin: true });
    expect(el().querySelector('button[aria-haspopup="menu"]')).toBeNull();
    expect(el().querySelector('button[aria-label="Previsualizar"]')).not.toBeNull();
    expect(el().querySelector('button[aria-label="Eliminar archivo"]')).not.toBeNull();
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true, file({ clasificado: true }), { isAdmin: true });
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
