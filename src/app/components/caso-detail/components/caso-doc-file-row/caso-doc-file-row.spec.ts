import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CasoDocFileRowComponent } from './caso-doc-file-row';
import type { CasoDocFile } from '../../../../interfaces';
import { cupoDePruebas } from '../../../../../testing/cupo-pruebas';

const file = (extra: Record<string, unknown> = {}): CasoDocFile =>
  ({ id: 'a1', folderId: null, name: 'nota.txt', downloadUrl: 'http://x/nota', mimeType: 'text/plain', sizeBytes: 2048, ...extra }) as unknown as CasoDocFile;

describe('CasoDocFileRowComponent', () => {
  let fixture: ComponentFixture<CasoDocFileRowComponent>;
  let eventos: string[];
  let resubidos: File[];
  let cupo: ReturnType<typeof cupoDePruebas>['cupo'];

  const el = (): HTMLElement => fixture.nativeElement;
  const texto = (): string => el().textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const porLabel = <T extends HTMLElement = HTMLButtonElement>(label: string): T | null =>
    el().querySelector<T>(`[aria-label="${label}"]`);

  function render(f: CasoDocFile, inputs: Record<string, unknown> = {}): void {
    fixture.componentRef.setInput('file', f);
    for (const [nombre, valor] of Object.entries(inputs)) fixture.componentRef.setInput(nombre, valor);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    const prueba = cupoDePruebas();
    cupo = prueba.cupo;
    await TestBed.configureTestingModule({ imports: [CasoDocFileRowComponent], providers: prueba.providers }).compileComponents();
    fixture = TestBed.createComponent(CasoDocFileRowComponent);
    const c = fixture.componentInstance;
    eventos = [];
    resubidos = [];
    c.preview.subscribe(() => eventos.push('preview'));
    c.downloaded.subscribe(() => eventos.push('downloaded'));
    c.downloadClassified.subscribe(() => eventos.push('downloadClassified'));
    c.history.subscribe(() => eventos.push('history'));
    c.access.subscribe(() => eventos.push('access'));
    c.deleteRequested.subscribe(() => eventos.push('deleteRequested'));
    c.deleteConfirmed.subscribe(() => eventos.push('deleteConfirmed'));
    c.deleteCancelled.subscribe(() => eventos.push('deleteCancelled'));
    c.reupload.subscribe(f => resubidos.push(f));
  });

  afterEach(() => vi.restoreAllMocks());

  it('muestra el nombre y el tamaño en la unidad adecuada', () => {
    render(file({ sizeBytes: 512 }));
    expect(texto()).toContain('nota.txt');
    expect(texto()).toContain('512 B');
    render(file({ sizeBytes: 2048 }));
    expect(texto()).toContain('2.0 KB');
    render(file({ sizeBytes: 5 * 1024 * 1024 }));
    expect(texto()).toContain('5.0 MB');
  });

  it('no muestra tamaño si se desconoce, ni versión hasta la segunda', () => {
    render(file({ sizeBytes: 0, version: 1 }));
    expect(texto()).toBe('nota.txt');
    render(file({ version: 2 }));
    expect(texto()).toContain('v2');
  });

  it('emite previsualizar, historial y acceso', () => {
    render(file(), { isAdmin: true });
    for (const label of ['Previsualizar', 'Ver historial', 'Gestionar acceso']) porLabel(label)!.click();
    expect(eventos).toEqual(['preview', 'history', 'access']);
  });

  it('la descarga normal es un enlace que avisa al pulsarse', () => {
    render(file());
    const enlace = porLabel<HTMLAnchorElement>('Descargar')!;
    expect(enlace.getAttribute('href')).toBe('http://x/nota');
    expect(enlace.hasAttribute('download')).toBe(true);
    enlace.addEventListener('click', e => e.preventDefault());
    enlace.click();
    expect(eventos).toEqual(['downloaded']);
  });

  it('un clasificado se marca y se descarga por botón, sin enlace directo', () => {
    render(file({ clasificado: true, downloadUrl: '' }));
    expect(porLabel('Documento clasificado')).not.toBeNull();
    expect(porLabel('Descargar')).toBeNull();
    porLabel('Descargar (documento clasificado)')!.click();
    expect(eventos).toEqual(['downloadClassified']);
  });

  it('el botón de nueva versión abre el selector y el archivo elegido se emite', () => {
    render(file());
    const input = el().querySelector<HTMLInputElement>('#reupload-file-a1')!;
    const spy = vi.spyOn(input, 'click');
    porLabel('Subir nueva versión')!.click();
    expect(spy).toHaveBeenCalled();

    const nuevo = new File(['x'], 'nota-v2.txt');
    Object.defineProperty(input, 'files', { value: [nuevo], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(resubidos).toEqual([nuevo]);
  });

  it('sin cupo NO abre el selector de la nueva versión', () => {
    cupo.puedeSubir.mockReturnValue(false);
    render(file());
    const input = el().querySelector<HTMLInputElement>('#reupload-file-a1')!;
    const spy = vi.spyOn(input, 'click');
    porLabel('Subir nueva versión')!.click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('si la nueva versión no cabe, no se emite la resubida', () => {
    cupo.admitir.mockReturnValue([]);
    render(file());
    const input = el().querySelector<HTMLInputElement>('#reupload-file-a1')!;
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'v2.txt')], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(resubidos).toEqual([]);
  });

  it('pide confirmación para eliminar', () => {
    render(file());
    porLabel('Eliminar archivo')!.click();
    expect(eventos).toEqual(['deleteRequested']);
    expect(porLabel('Confirmar borrado')).toBeNull();

    render(file(), { confirmingDelete: true });
    expect(porLabel('Eliminar archivo')).toBeNull();
    porLabel('Cancelar')!.click();
    porLabel('Confirmar borrado')!.click();
    expect(eventos).toEqual(['deleteRequested', 'deleteCancelled', 'deleteConfirmed']);
  });

  it('respeta los permisos de edición, borrado y administración', () => {
    render(file(), { canEdit: false, canDelete: false, isAdmin: false, confirmingDelete: true });
    for (const label of ['Subir nueva versión', 'Gestionar acceso', 'Eliminar archivo', 'Confirmar borrado']) {
      expect(porLabel(label), label).toBeNull();
    }
    expect(el().querySelector('input[type="file"]')).toBeNull();
  });
});
