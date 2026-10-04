import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CasoDetailHeaderComponent, type CasoTab } from './caso-detail-header';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

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

  async function montar(mobile: boolean, tab: CasoTab = 'info'): Promise<void> {
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
    await montar(true, 'hitos');
    const select = el().querySelector<HTMLSelectElement>('select#caso-seccion')!;
    expect(select).not.toBeNull();
    expect(el().querySelector('label[for="caso-seccion"]')!.textContent).toContain('Sección');
    expect(select.value).toBe('hitos');
    expect(el().querySelector('[role="tablist"]')).toBeNull();
  });

  it('móvil: cambiar el select emite tabChange', async () => {
    await montar(true);
    const out: CasoTab[] = [];
    fixture.componentInstance.tabChange.subscribe((t) => out.push(t));
    const select = el().querySelector<HTMLSelectElement>('select#caso-seccion')!;
    select.value = 'documentos';
    select.dispatchEvent(new Event('change'));
    expect(out).toEqual(['documentos']);
  });

  it('móvil: ignora valores desconocidos', async () => {
    const out: CasoTab[] = [];
    await montar(true);
    fixture.componentInstance.tabChange.subscribe((t) => out.push(t));
    fixture.componentInstance.seleccionarTab('nope');
    expect(out).toEqual([]);
  });

  it('escritorio: tablist con pestañas y sin select', async () => {
    await montar(false);
    expect(el().querySelector('[role="tablist"]')).not.toBeNull();
    expect(el().querySelectorAll('[role="tab"]')).toHaveLength(4);
    expect(el().querySelector('select')).toBeNull();
  });

  it('el título envuelve en lugar de truncarse', async () => {
    await montar(true);
    const h1 = el().querySelector('h1')!;
    expect(h1.classList.contains('truncate')).toBe(false);
    expect(h1.classList.contains('break-words')).toBe(true);
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
