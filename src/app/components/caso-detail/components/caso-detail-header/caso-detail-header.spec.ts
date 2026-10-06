import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CasoDetailHeaderComponent, type CasoTab } from './caso-detail-header';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

async function montar(canEdit: boolean, editing = false) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [CasoDetailHeaderComponent],
    providers: [provideRouter([])],
  }).compileComponents();
  const f = TestBed.createComponent(CasoDetailHeaderComponent);
  const set = (k: string, v: unknown) => f.componentRef.setInput(k, v);
  set('titulo', 'Divorcio'); set('estado', 'pendiente'); set('tipo', 'Civil'); set('editing', editing);
  set('activeTab', 'info'); set('hitosCount', 0); set('movimientosCount', 0); set('gestoriaPending', 0);
  set('docsPending', 0); set('canEdit', canEdit);
  f.detectChanges();
  return f;
}

describe('CasoDetailHeaderComponent: acciones', () => {
  it('muestra "Notificar / Acciones" y emite acciones al pulsarlo', async () => {
    const f = await montar(true);
    const spy = vi.fn();
    f.componentInstance.acciones.subscribe(spy);
    const btn = (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="caso-acciones"]')!;
    expect(btn.textContent).toContain('Notificar / Acciones');
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('en móvil los botones bajan a su propia fila y no le roban ancho al título', async () => {
    const el = (await montar(true)).nativeElement as HTMLElement;
    const fila = el.querySelector('[data-caso-cabecera]')!;
    expect(fila.className).toContain('flex-col');
    expect(fila.className).toContain('sm:flex-row');
    const acciones = el.querySelector('[data-caso-header-acciones]')!;
    expect(acciones.className).toContain('w-full');
    expect(acciones.className).toContain('sm:w-auto');
    expect(acciones.className).not.toMatch(/(^|\s)shrink-0/);
    acciones.querySelectorAll('button').forEach((b) => expect(b.className).toContain('flex-1'));
  });

  it('muestra la etiqueta legible del estado', async () => {
    const f = await montar(true);
    f.componentRef.setInput('estado', 'en_proceso');
    f.detectChanges();
    const texto = (f.nativeElement as HTMLElement).textContent!;
    expect(texto).toContain('En proceso');
    expect(texto).not.toContain('en_proceso');
  });

  it('no se muestra sin permiso de edición ni mientras se edita', async () => {
    expect(((await montar(false)).nativeElement as HTMLElement).querySelector('[data-testid="caso-acciones"]')).toBeNull();
    expect(((await montar(true, true)).nativeElement as HTMLElement).querySelector('[data-testid="caso-acciones"]')).toBeNull();
  });
});

function mockViewport(mobile: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: mobile && /max-width: 639px/.test(q),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

describe('CasoDetailHeaderComponent — responsive', () => {
  let fixture: ComponentFixture<CasoDetailHeaderComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montarResponsive(mobile: boolean, tab: CasoTab = 'info'): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [CasoDetailHeaderComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(CasoDetailHeaderComponent);
    const set = (k: string, v: unknown): void => fixture.componentRef.setInput(k, v);
    set('titulo', 'Un título de caso bastante largo para comprobar que envuelve');
    set('estado', 'pendiente');
    set('tipo', 'Legal');
    set('editing', false);
    set('activeTab', tab);
    set('hitosCount', 2);
    set('movimientosCount', 3);
    set('gestoriaPending', 0);
    set('docsPending', 1);
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('móvil: selector etiquetado "Sección" en lugar de tablist', async () => {
    await montarResponsive(true, 'hitos');
    const select = el().querySelector<HTMLSelectElement>('select#caso-seccion')!;
    expect(select).not.toBeNull();
    expect(el().querySelector('label[for="caso-seccion"]')!.textContent).toContain('Sección');
    expect(select.value).toBe('hitos');
    expect(el().querySelector('[role="tablist"]')).toBeNull();
  });

  it('móvil: cambiar el select emite tabChange', async () => {
    await montarResponsive(true);
    const out: CasoTab[] = [];
    fixture.componentInstance.tabChange.subscribe((t) => out.push(t));
    const select = el().querySelector<HTMLSelectElement>('select#caso-seccion')!;
    select.value = 'documentos';
    select.dispatchEvent(new Event('change'));
    expect(out).toEqual(['documentos']);
  });

  it('móvil: ignora valores desconocidos', async () => {
    const out: CasoTab[] = [];
    await montarResponsive(true);
    fixture.componentInstance.tabChange.subscribe((t) => out.push(t));
    fixture.componentInstance.seleccionarTab('nope');
    expect(out).toEqual([]);
  });

  it('escritorio: tablist con pestañas y sin select', async () => {
    await montarResponsive(false);
    expect(el().querySelector('[role="tablist"]')).not.toBeNull();
    expect(el().querySelectorAll('[role="tab"]')).toHaveLength(4);
    expect(el().querySelector('select')).toBeNull();
  });

  it('el título envuelve en lugar de truncarse', async () => {
    await montarResponsive(true);
    const h1 = el().querySelector('h1')!;
    expect(h1.classList.contains('truncate')).toBe(false);
    expect(h1.classList.contains('break-words')).toBe(true);
  });

  it('móvil: sin violaciones axe', async () => {
    await montarResponsive(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
