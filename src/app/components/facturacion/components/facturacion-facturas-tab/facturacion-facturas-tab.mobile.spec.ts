import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturacionFacturasTabComponent } from './facturacion-facturas-tab';
import type { Invoice } from '../../../../core/services/invoice.service';
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

function factura(numero: string, override: Partial<Invoice> = {}): Invoice {
  return {
    id: `id-${numero}`,
    companyId: 'c-1',
    invoiceNumber: numero,
    amount: 100,
    vat: 21,
    total: 121,
    status: 'pendiente',
    issueDate: '2026-09-01',
    dueDate: '2026-10-01',
    clienteNombre: 'Cliente SL',
    ...override,
  };
}

const BORRADOR = factura('B-1', { status: 'borrador' });
const EMITIDA = factura('E-1', { pdfUrl: 'https://x/e1.pdf' });
const PAGADA = factura('P-1', { status: 'pagada' });
const ANULADA = factura('A-1', { status: 'anulada' });

describe('FacturacionFacturasTabComponent — móvil', () => {
  let fixture: ComponentFixture<FacturacionFacturasTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, invoices: Invoice[]): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    await TestBed.configureTestingModule({ imports: [FacturacionFacturasTabComponent] }).compileComponents();
    fixture = TestBed.createComponent(FacturacionFacturasTabComponent);
    fixture.componentRef.setInput('invoices', invoices);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  describe('lista', () => {
    it('móvil: una tarjeta por factura y sin tabla', async () => {
      await montar(true, [BORRADOR, EMITIDA, ANULADA]);
      expect(el().querySelector('table')).toBeNull();
      expect(el().querySelectorAll('ul > li')).toHaveLength(3);
      expect(el().textContent).toContain('E-1');
      expect(el().textContent).toContain('Cliente SL');
    });

    it('escritorio: tabla y sin tarjetas', async () => {
      await montar(false, [BORRADOR, EMITIDA]);
      expect(el().querySelector('table')).not.toBeNull();
      expect(el().querySelectorAll('tbody tr')).toHaveLength(2);
      expect(el().querySelector('ul > li')).toBeNull();
    });

    it('móvil: la tarjeta muestra estado y chip Verifactu', async () => {
      await montar(true, [factura('V-1', { verifactu: { estado: 'enviado', tipoRegistro: 'alta', csv: 'CSV-9' } })]);
      const li = el().querySelector('ul > li')!;
      expect(li.textContent).toContain('Pendiente');
      expect(li.textContent).toContain('Registrada en AEAT');
      expect(li.textContent).toContain('CSV-9');
    });

    it('móvil sin facturas: muestra el texto vacío', async () => {
      await montar(true, []);
      expect(el().textContent).toContain('No hay facturas que coincidan con los filtros');
    });

    it('móvil: la tarjeta lleva el estado como acento visual', async () => {
      await montar(true, [BORRADOR, EMITIDA, PAGADA]);
      const estados = Array.from(el().querySelectorAll<HTMLElement>('[data-factura-card]')).map((c) => c.dataset['estado']);
      expect(estados).toEqual(['borrador', 'pendiente', 'pagada']);
    });

    it('móvil: cliente y total destacados en la cabecera de la tarjeta', async () => {
      await montar(true, [EMITIDA]);
      const card = el().querySelector('[data-factura-card]')!;
      expect(card.querySelector('[data-cliente]')!.textContent!.trim()).toBe('Cliente SL');
      expect(card.querySelector('[data-total]')!.textContent).toContain('121.00');
    });

    it('móvil: fechas legibles en español', async () => {
      await montar(true, [EMITIDA]);
      const card = el().querySelector('[data-factura-card]')!;
      expect(card.textContent).toContain('1 sep 2026');
      expect(card.textContent).toContain('vence 1 oct 2026');
    });

    it('móvil: anulada atenuada con total tachado', async () => {
      await montar(true, [ANULADA]);
      expect(el().querySelector('[data-total]')!.className).toContain('line-through');
    });

    it('móvil: acción principal visible según el estado', async () => {
      await montar(true, [BORRADOR, EMITIDA, PAGADA, ANULADA]);
      const principales = Array.from(el().querySelectorAll<HTMLElement>('[data-factura-card]')).map(
        (c) => c.querySelector('[data-accion-principal]')?.textContent?.trim() ?? null,
      );
      expect(principales).toEqual(['Finalizar', 'Marcar pagada', null, null]);
    });

    it('móvil: la acción principal despacha al mismo output', async () => {
      await montar(true, [EMITIDA]);
      const emitidos: string[] = [];
      fixture.componentInstance.markPaid.subscribe((id) => emitidos.push(id));
      el().querySelector<HTMLButtonElement>('[data-accion-principal]')!.click();
      expect(emitidos).toEqual(['id-E-1']);
    });

    it('el resumen puede envolver en móvil', async () => {
      await montar(true, [EMITIDA]);
      const resumen = el().querySelector('[data-resumen]')!;
      expect(resumen.className).toContain('grid-cols-2');
    });
  });

  describe('accionesFactura (misma lógica que los botones de escritorio)', () => {
    const ids = (f: Invoice): string[] => fixtureInstance().accionesFactura(f).map((a) => a.id);
    const fixtureInstance = (): FacturacionFacturasTabComponent => fixture.componentInstance;

    beforeEach(async () => montar(false, []));

    it('borrador: editar, cambiar número y finalizar; no anular ni cobrar', () => {
      expect(ids(BORRADOR)).toEqual(['edit', 'editNumber', 'finalize']);
    });

    it('emitida pendiente con PDF: editar, número, PDF, enlace, cobrar, rectificar, anular', () => {
      expect(ids(EMITIDA)).toEqual(['edit', 'editNumber', 'download', 'copyLink', 'markPaid', 'rectify', 'anular']);
    });

    it('pagada: sin cobrar, con rectificar y anular', () => {
      expect(ids(PAGADA)).toEqual(['edit', 'editNumber', 'rectify', 'anular']);
    });

    it('anulada: ninguna acción de edición/anulación', () => {
      expect(ids(ANULADA)).toEqual([]);
    });

    it('rectificativa (R1): no se puede rectificar', () => {
      expect(ids(factura('R-1', { tipoFactura: 'R1' }))).not.toContain('rectify');
    });

    it('Verifactu en cola: sin editar ni renumerar, con reintentar', () => {
      const f = factura('Q-1', { verifactu: { estado: 'en_cola', tipoRegistro: 'alta' } });
      expect(ids(f)).toContain('retry');
      expect(ids(f)).not.toContain('edit');
      expect(ids(f)).not.toContain('editNumber');
    });

    it('las etiquetas coinciden con el title de los botones de escritorio', async () => {
      for (const inv of [BORRADOR, EMITIDA, PAGADA, ANULADA]) {
        await montar(false, [inv]);
        const titulos = Array.from(el().querySelectorAll<HTMLButtonElement>('tbody button')).map((b) => b.title);
        const etiquetas = fixture.componentInstance.accionesFactura(inv).map((a) => a.label);
        expect(etiquetas, inv.invoiceNumber).toEqual(titulos);
      }
    });
  });

  describe('acciones desde la tarjeta', () => {
    async function elegir(inv: Invoice, id: string): Promise<void> {
      el().querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      el().querySelector<HTMLButtonElement>(`[data-action-id="${id}"]`)!.click();
      fixture.detectChanges();
    }

    it('cobrar emite markPaid con el id, igual que el botón de escritorio', async () => {
      await montar(true, [EMITIDA]);
      const emitidos: string[] = [];
      fixture.componentInstance.markPaid.subscribe((id) => emitidos.push(id));
      await elegir(EMITIDA, 'markPaid');
      expect(emitidos).toEqual(['id-E-1']);
    });

    it('editar emite editInvoice con la factura', async () => {
      await montar(true, [BORRADOR]);
      const emitidos: Invoice[] = [];
      fixture.componentInstance.editInvoice.subscribe((i) => emitidos.push(i));
      await elegir(BORRADOR, 'edit');
      expect(emitidos).toEqual([BORRADOR]);
    });

    it('reintentar usa el mismo handler (anuncia y emite retryVerifactu)', async () => {
      const f = factura('F-1', { verifactu: { estado: 'error', tipoRegistro: 'alta', errorMessage: 'x' } });
      await montar(true, [f]);
      const emitidos: string[] = [];
      fixture.componentInstance.retryVerifactu.subscribe((id) => emitidos.push(id));
      await elegir(f, 'retry');
      expect(emitidos).toEqual(['id-F-1']);
      expect(fixture.componentInstance.anuncio()).toContain('F-1');
    });

    it('anular, finalizar, rectificar, número, pdf y enlace despachan a sus outputs', async () => {
      const casos: [string, Invoice, string][] = [
        ['anular', EMITIDA, 'anularFactura'],
        ['finalize', BORRADOR, 'finalizeDraft'],
        ['rectify', EMITIDA, 'createRectificativa'],
        ['editNumber', EMITIDA, 'editNumber'],
        ['download', EMITIDA, 'downloadPdf'],
        ['copyLink', EMITIDA, 'copyPdfLink'],
      ];
      for (const [id, inv, output] of casos) {
        await montar(true, [inv]);
        let llamadas = 0;
        (fixture.componentInstance as unknown as Record<string, { subscribe(fn: () => void): void }>)[output].subscribe(
          () => llamadas++,
        );
        await elegir(inv, id);
        expect(llamadas, output).toBe(1);
      }
    });

    it('sin acciones (anulada) no pinta el menú', async () => {
      await montar(true, [ANULADA]);
      expect(el().querySelector('button[aria-haspopup="menu"]')).toBeNull();
    });
  });

  describe('filtros', () => {
    it('móvil: búsqueda + botón Filtros; los filtros completos no están en línea', async () => {
      await montar(true, [EMITIDA]);
      expect(el().querySelector('input[type="text"]')).not.toBeNull();
      expect(el().querySelector('input[type="date"]')).toBeNull();
      expect(el().querySelector('[data-filtros-btn]')).not.toBeNull();
    });

    it('escritorio: barra de filtros en línea, sin botón Filtros', async () => {
      await montar(false, [EMITIDA]);
      expect(el().querySelectorAll('input[type="date"]')).toHaveLength(2);
      expect(el().querySelector('[data-filtros-btn]')).toBeNull();
    });

    it('el badge cuenta los filtros activos (estado, desde, hasta)', async () => {
      await montar(true, [EMITIDA]);
      const badge = (): HTMLElement | null => el().querySelector('[data-filtros-badge]');
      expect(badge()).toBeNull();
      fixture.componentInstance.statusFilter.set('pendiente');
      fixture.detectChanges();
      expect(badge()!.textContent!.trim()).toBe('1');
      fixture.componentInstance.dateFrom.set('2026-01-01');
      fixture.componentInstance.dateTo.set('2026-12-31');
      fixture.detectChanges();
      expect(badge()!.textContent!.trim()).toBe('3');
    });

    it('la búsqueda no cuenta como filtro activo', async () => {
      await montar(true, [EMITIDA]);
      fixture.componentInstance.searchQuery.set('abc');
      fixture.detectChanges();
      expect(el().querySelector('[data-filtros-badge]')).toBeNull();
    });

    it('Filtros abre una hoja modal que comparte estado con las señales', async () => {
      await montar(true, [BORRADOR, EMITIDA]);
      expect(el().querySelector('[role="dialog"]')).toBeNull();
      el().querySelector<HTMLButtonElement>('[data-filtros-btn]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      const dlg = el().querySelector('[role="dialog"]')!;
      expect(dlg.textContent).toContain('Filtros');

      const select = dlg.querySelector<HTMLSelectElement>('select')!;
      select.value = 'borrador';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.componentInstance.statusFilter()).toBe('borrador');
      expect(el().querySelectorAll('ul > li')).toHaveLength(1);
    });

    it('Limpiar restablece los filtros y Aplicar cierra la hoja', async () => {
      await montar(true, [BORRADOR, EMITIDA]);
      fixture.componentInstance.statusFilter.set('borrador');
      fixture.componentInstance.dateFrom.set('2026-01-01');
      el().querySelector<HTMLButtonElement>('[data-filtros-btn]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      const dlg = el().querySelector('[role="dialog"]')!;
      const botones = Array.from(dlg.querySelectorAll<HTMLButtonElement>('button'));
      botones.find((b) => b.textContent?.trim() === 'Limpiar')!.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.statusFilter()).toBe('todos');
      expect(fixture.componentInstance.dateFrom()).toBe('');
      botones.find((b) => b.textContent?.trim() === 'Aplicar')!.click();
      fixture.detectChanges();
      expect(el().querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it('móvil: sin violaciones axe (tarjetas, hoja de filtros)', async () => {
    await montar(true, [BORRADOR, EMITIDA, ANULADA]);
    el().querySelector<HTMLButtonElement>('[data-filtros-btn]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const violaciones = await analizarA11y(el());
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
