import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturacionArchivoTabComponent } from './facturacion-archivo-tab';
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

function caso(id: string, facturaId?: string): Caso {
  return {
    id, titulo: `Caso ${id}`, tipo: 'Herencia', estado: 'cerrado', facturaId,
    resumenFinanciero: { saldo: 200 }, cierreSaldoBancario: 180, cierreConfirmadoAt: '2026-09-30T10:00:00Z',
  } as unknown as Caso;
}

const FACTURA: Invoice = {
  id: 'f-1', companyId: 'co', invoiceNumber: '2026-001', amount: 100, vat: 21, total: 121,
  status: 'pendiente', issueDate: '2026-10-01', dueDate: '2026-10-31', pdfUrl: 'https://x/f1.pdf',
  verifactu: { estado: 'error', tipoRegistro: 'alta', errorMessage: 'Falta NIF' },
};

describe('FacturacionArchivoTabComponent — móvil', () => {
  let fixture: ComponentFixture<FacturacionArchivoTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, casos: Caso[], canReabrir = true): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [FacturacionArchivoTabComponent] });
    fixture = TestBed.createComponent(FacturacionArchivoTabComponent);
    fixture.componentRef.setInput('casos', casos);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('canReabrir', canReabrir);
    fixture.componentRef.setInput('invoiceMap', new Map([[FACTURA.id, FACTURA]]));
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('móvil: tarjetas sin tabla, con saldo, cierre y estado de factura', async () => {
    await montar(true, [caso('k-1', 'f-1'), caso('k-2')]);
    expect(el().querySelector('table')).toBeNull();
    const lis = el().querySelectorAll('ul > li');
    expect(lis).toHaveLength(2);
    expect(lis[0].textContent).toContain('200€');
    expect(lis[0].textContent).toContain('180€');
    expect(lis[0].textContent).toContain('2026-09-30');
    expect(lis[0].textContent).toContain('Emitida');
    expect(lis[0].textContent).toContain('Falta NIF');
    expect(lis[1].textContent).toContain('Sin factura');
  });

  it('escritorio: tabla', async () => {
    await montar(false, [caso('k-1')]);
    expect(el().querySelector('table')).not.toBeNull();
    expect(el().querySelector('ul > li')).toBeNull();
  });

  it('móvil: tocar la tarjeta navega al caso', async () => {
    await montar(true, [caso('k-1')]);
    const ids: string[] = [];
    fixture.componentInstance.navigateToCaso.subscribe((id) => ids.push(id));
    el().querySelector<HTMLButtonElement>('button[data-abrir-caso]')!.click();
    expect(ids).toEqual(['k-1']);
  });

  it('móvil: el menú ofrece Reabrir, Descargar PDF, Copiar link y Reintentar según corresponda', async () => {
    await montar(true, [caso('k-1', 'f-1')]);
    expect(fixture.componentInstance.accionesCaso(caso('k-1', 'f-1')).map((a) => a.id)).toEqual([
      'download', 'copyLink', 'retry', 'reopen',
    ]);
    expect(fixture.componentInstance.accionesCaso(caso('k-2')).map((a) => a.id)).toEqual(['reopen']);
  });

  it('móvil: sin permiso de reabrir y sin factura, no hay acciones ni menú', async () => {
    await montar(true, [caso('k-2')], false);
    expect(el().querySelector('button[aria-haspopup="menu"]')).toBeNull();
  });

  it('móvil: elegir acciones emite los mismos outputs que escritorio', async () => {
    await montar(true, [caso('k-1', 'f-1')]);
    const out: string[] = [];
    fixture.componentInstance.downloadPdf.subscribe((id) => out.push(`pdf:${id}`));
    fixture.componentInstance.copyPdfLink.subscribe((id) => out.push(`link:${id}`));
    fixture.componentInstance.reabrirCaso.subscribe((c) => out.push(`reopen:${c.id}`));
    fixture.componentInstance.retryVerifactu.subscribe((id) => out.push(`retry:${id}`));
    for (const id of ['download', 'copyLink', 'reopen', 'retry']) {
      el().querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      el().querySelector<HTMLButtonElement>(`[data-action-id="${id}"]`)!.click();
      fixture.detectChanges();
      await fixture.whenStable();
    }
    expect(out).toEqual(['pdf:f-1', 'link:f-1', 'reopen:k-1', 'retry:f-1']);
  });

  it('móvil: sin casos muestra texto vacío', async () => {
    await montar(true, []);
    expect(el().textContent).toContain('No hay casos cerrados');
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true, [caso('k-1', 'f-1'), caso('k-2')]);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
