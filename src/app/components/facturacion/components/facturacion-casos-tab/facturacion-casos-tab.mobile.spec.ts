import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FacturacionCasosTabComponent } from './facturacion-casos-tab';
import type { Invoice } from '../../../../core/services/invoice.service';
import type { Caso } from '../../../../interfaces';
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

function caso(id: string, titulo: string, facturaIds: string[] = []): Caso {
  return {
    id, titulo, tipo: 'Herencia', estado: 'en_proceso', facturaIds,
    resumenFinanciero: { totalIngresos: 500, totalSuplidos: 50, totalHonorarios: 100, saldo: 350 },
    gestoriaResumenSlots: { total: 1, registrados: 1 },
  } as unknown as Caso;
}

const FACTURA: Invoice = {
  id: 'f-1', companyId: 'co', invoiceNumber: '2026-001', amount: 100, vat: 21, total: 121,
  status: 'pendiente', issueDate: '2026-10-01', dueDate: '2026-10-31', pdfUrl: 'https://x/f1.pdf',
};

describe('FacturacionCasosTabComponent — móvil', () => {
  let fixture: ComponentFixture<FacturacionCasosTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, casos: Caso[], canCreate = true): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [FacturacionCasosTabComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(FacturacionCasosTabComponent);
    fixture.componentRef.setInput('casos', casos);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('canCreate', canCreate);
    fixture.componentRef.setInput('invoiceMap', new Map([[FACTURA.id, FACTURA]]));
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('móvil: una tarjeta por caso, sin tabla, con enlace y saldo', async () => {
    await montar(true, [caso('k-1', 'Caso 1'), caso('k-2', 'Caso 2')]);
    expect(el().querySelector('table')).toBeNull();
    expect(el().querySelectorAll('ul > li')).toHaveLength(2);
    expect(el().querySelector('a[href="/casos/k-1"]')?.textContent?.trim()).toBe('Caso 1');
    expect(el().textContent).toContain('350€');
  });

  it('escritorio: tabla y sin tarjetas', async () => {
    await montar(false, [caso('k-1', 'Caso 1')]);
    expect(el().querySelector('table')).not.toBeNull();
    expect(el().querySelector('ul > li')).toBeNull();
  });

  it('móvil: el menú ofrece Generar factura y Cerrar caso y emite lo mismo que los botones', async () => {
    await montar(true, [caso('k-1', 'Caso 1')]);
    const generadas: Caso[] = [];
    const cierres: Caso[] = [];
    fixture.componentInstance.abrirFactura.subscribe((c) => generadas.push(c));
    fixture.componentInstance.abrirCierre.subscribe((c) => cierres.push(c));

    for (const id of ['factura', 'cierre']) {
      el().querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      const item = el().querySelector<HTMLButtonElement>(`[data-action-id="${id}"]`)!;
      expect(item.textContent).toContain(id === 'factura' ? 'Generar factura' : 'Cerrar caso');
      item.click();
      fixture.detectChanges();
      await fixture.whenStable();
    }
    expect(generadas.map((c) => c.id)).toEqual(['k-1']);
    expect(cierres.map((c) => c.id)).toEqual(['k-1']);
  });

  it('móvil: con facturas la etiqueta pasa a "Nueva factura"', async () => {
    await montar(true, [caso('k-1', 'Caso 1', ['f-1'])]);
    expect(fixture.componentInstance.accionesCaso(caso('k-1', 'x', ['f-1'])).map((a) => a.label)).toEqual([
      'Nueva factura', 'Cerrar caso',
    ]);
  });

  it('móvil sin permiso de crear: no hay menú', async () => {
    await montar(true, [caso('k-1', 'Caso 1')], false);
    expect(el().querySelector('button[aria-haspopup="menu"]')).toBeNull();
  });

  it('móvil: el acordeón de facturas funciona en la tarjeta', async () => {
    await montar(true, [caso('k-1', 'Caso 1', ['f-1'])]);
    const toggle = el().querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await fixture.whenStable();
    const panel = el().querySelector(`#${toggle.getAttribute('aria-controls')}`)!;
    expect(panel.textContent).toContain('2026-001');
    expect(panel.querySelector('a')?.getAttribute('href')).toBe('https://x/f1.pdf');
  });

  it('móvil: sin casos muestra el texto vacío', async () => {
    await montar(true, []);
    expect(el().textContent).toContain('No hay casos abiertos');
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true, [caso('k-1', 'Caso 1', ['f-1'])]);
    el().querySelector<HTMLButtonElement>('button[aria-expanded]')!.click();
    await fixture.whenStable();
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
