import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ReportesTabComponent, type Reporte } from './reportes-tab';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

function mockViewport(mobile: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: mobile && /max-width/.test(q),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

const REPORTE: Reporte = {
  porTipo: [
    { tipo: 'ingreso', importe: 1210, base: 1000, cuota: 210, count: 2 },
    { tipo: 'gasto', importe: 121, base: 100, cuota: 21, count: 1 },
    { tipo: 'otro', importe: 0, base: 0, cuota: 0, count: 0 },
  ],
  ingresos: 1210, egresos: 121, saldo: 1089,
  ivaRepercutido: 210, ivaSoportado: 21, liquidacionIva: 189,
  totalMovimientos: 3,
};

describe('ReportesTabComponent — móvil', () => {
  let fixture: ComponentFixture<ReportesTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, reporte: Reporte = REPORTE): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    await TestBed.configureTestingModule({ imports: [ReportesTabComponent] }).compileComponents();
    fixture = TestBed.createComponent(ReportesTabComponent);
    fixture.componentRef.setInput('reporte', reporte);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('móvil: P&G por tipo en tarjetas, solo tipos con movimientos; sin tabla', async () => {
    await montar(true);
    expect(el().querySelector('table')).toBeNull();
    const items = el().querySelectorAll('[data-tipo-card]');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Ingreso');
    expect(items[0].textContent).toContain('1,000.00');
    expect(items[0].textContent).toContain('210.00');
    expect(items[0].textContent).toContain('1,210.00');
  });

  it('móvil: sin movimientos muestra el texto vacío', async () => {
    await montar(true, { ...REPORTE, porTipo: [], totalMovimientos: 0 });
    expect(el().textContent).toContain('Sin movimientos en el periodo seleccionado.');
  });

  it('las fechas tienen etiqueta asociada y el filtro es rejilla de 2 columnas en móvil', async () => {
    await montar(true);
    expect(el().querySelector('label[for="reportes-desde"]')).not.toBeNull();
    expect(el().querySelector('input#reportes-desde')).not.toBeNull();
    expect(el().querySelector('label[for="reportes-hasta"]')).not.toBeNull();
    const filtro = el().querySelector('[data-reportes-filtro]')!;
    expect(filtro.className).toContain('grid-cols-2');
    expect(filtro.className).toContain('sm:flex');
  });

  it('escritorio: tabla y sin tarjetas', async () => {
    await montar(false);
    expect(el().querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el().querySelector('[data-tipo-card]')).toBeNull();
  });

  it('móvil: sin violaciones de accesibilidad', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
