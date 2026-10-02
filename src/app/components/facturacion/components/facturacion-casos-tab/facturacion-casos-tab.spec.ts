import { describe, it, expect } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FacturacionCasosTabComponent } from './facturacion-casos-tab';
import type { Invoice } from '../../../../core/services/invoice.service';
import type { Caso } from '../../../../interfaces';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

function caso(id: string, titulo: string, facturaIds: string[]): Caso {
  return {
    id, titulo, tipo: 'Herencia', estado: 'en_proceso', facturaIds,
    resumenFinanciero: { totalIngresos: 0, totalSuplidos: 0, totalHonorarios: 100, saldo: 0 },
    gestoriaResumenSlots: { total: 1, registrados: 1 },
  } as unknown as Caso;
}

function factura(id: string, numero: string, override: Partial<Invoice> = {}): Invoice {
  return {
    id, companyId: 'co', invoiceNumber: numero, amount: 100, vat: 21, total: 121,
    status: 'pendiente', issueDate: '2026-10-01', dueDate: '2026-10-31',
    pdfUrl: `https://storage.example/${id}.pdf`,
    ...override,
  };
}

describe('FacturacionCasosTabComponent', () => {
  let fixture: ComponentFixture<FacturacionCasosTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const texto = (e: Element): string => e.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  async function montar(casos: Caso[], facturas: Invoice[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [FacturacionCasosTabComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(FacturacionCasosTabComponent);
    fixture.componentRef.setInput('casos', casos);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('canCreate', true);
    fixture.componentRef.setInput('invoiceMap', new Map(facturas.map((f) => [f.id, f])));
    await fixture.whenStable();
  }

  const toggle = (): HTMLButtonElement => {
    const b = Array.from(el().querySelectorAll<HTMLButtonElement>('button[aria-expanded]'))[0];
    expect(b, 'botón del acordeón').toBeTruthy();
    return b;
  };

  it('el nombre del caso es un enlace a su ficha', async () => {
    await montar([caso('k-1', 'Herencia García', [])], []);
    const link = el().querySelector<HTMLAnchorElement>('a[href="/casos/k-1"]');
    expect(link).toBeTruthy();
    expect(texto(link!)).toBe('Herencia García');
  });

  it('las facturas del caso se agrupan en un acordeón cerrado: un solo botón, ningún enlace a PDF', async () => {
    await montar(
      [caso('k-1', 'Caso 1', ['f-1', 'f-2'])],
      [factura('f-1', '2026-001', { status: 'pagada' }), factura('f-2', '2026-002')],
    );
    expect(el().querySelectorAll('button[aria-expanded]').length).toBe(1);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(texto(toggle())).toContain('2 facturas');
    expect(el().querySelectorAll('a[target="_blank"]').length).toBe(0);
  });

  it('al abrirlo lista cada factura con su número, estado y un enlace para abrir el PDF', async () => {
    await montar(
      [caso('k-1', 'Caso 1', ['f-1', 'f-2'])],
      [factura('f-1', '2026-001', { status: 'pagada' }), factura('f-2', '2026-002')],
    );
    toggle().click();
    await fixture.whenStable();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    const panel = el().querySelector(`#${toggle().getAttribute('aria-controls')}`);
    expect(panel, 'panel controlado por el botón').toBeTruthy();

    const items = Array.from(panel!.querySelectorAll('li'));
    expect(items.map(texto)).toEqual([
      expect.stringMatching(/2026-001.*Pagada/),
      expect.stringMatching(/2026-002.*Pendiente/),
    ]);
    const enlace = items[0].querySelector<HTMLAnchorElement>('a')!;
    expect(enlace.getAttribute('href')).toBe('https://storage.example/f-1.pdf');
    expect(enlace.target).toBe('_blank');
    expect(enlace.rel).toContain('noopener');

    toggle().click();
    await fixture.whenStable();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(el().querySelectorAll('li').length).toBe(0);
  });

  it('una factura sin PDF se lista sin enlace', async () => {
    await montar([caso('k-1', 'Caso 1', ['f-1'])], [factura('f-1', '2026-001', { pdfUrl: undefined })]);
    toggle().click();
    await fixture.whenStable();
    const item = el().querySelector('li')!;
    expect(texto(item)).toContain('PDF no disponible');
    expect(item.querySelector('a')).toBeNull();
  });

  it('pasa axe con el acordeón abierto', async () => {
    await montar([caso('k-1', 'Caso 1', ['f-1', 'f-2'])], [factura('f-1', '2026-001'), factura('f-2', '2026-002')]);
    toggle().click();
    await fixture.whenStable();
    const violaciones = await analizarA11y(el().querySelector('table')!);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
