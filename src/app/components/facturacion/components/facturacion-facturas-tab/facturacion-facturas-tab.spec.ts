import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturacionFacturasTabComponent } from './facturacion-facturas-tab';
import type { Invoice } from '../../../../core/services/invoice.service';
import type { VerifactuEstado } from '../../../../interfaces/verifactu.interface';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const AHORA = '2026-10-01T10:00:00Z';

function factura(numero: string, verifactu?: VerifactuEstado, override: Partial<Invoice> = {}): Invoice {
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
    verifactu,
    ...override,
  };
}

describe('FacturacionFacturasTabComponent — Verifactu (R9.2, R9.3, R9.4)', () => {
  let fixture: ComponentFixture<FacturacionFacturasTabComponent>;

  const el = (): HTMLElement => fixture.nativeElement;
  const texto = (e: Element): string => e.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  function fila(numero: string): HTMLTableRowElement {
    const row = Array.from(el().querySelectorAll<HTMLTableRowElement>('tbody tr')).find((r) =>
      texto(r).includes(numero),
    );
    expect(row, `fila ${numero}`).toBeTruthy();
    return row!;
  }
  const botonPorEtiqueta = (raiz: Element, etiqueta: RegExp): HTMLButtonElement | undefined =>
    Array.from(raiz.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      etiqueta.test(b.getAttribute('aria-label') ?? ''),
    );

  async function montar(invoices: Invoice[]): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [FacturacionFacturasTabComponent] }).compileComponents();
    fixture = TestBed.createComponent(FacturacionFacturasTabComponent);
    fixture.componentRef.setInput('invoices', invoices);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(AHORA));
  });
  afterEach(() => vi.useRealTimers());

  it('error con mensaje: lo muestra y ofrece Reintentar que emite el id (S9.1)', async () => {
    await montar([
      factura('F-1', { estado: 'error', tipoRegistro: 'alta', errorKind: 'precondicion', errorMessage: 'Falta el NIF del cliente' }),
    ]);
    const row = fila('F-1');

    expect(texto(row)).toContain('Falta el NIF del cliente');
    const reintentar = botonPorEtiqueta(row, /Reintentar.*F-1/);
    expect(reintentar).toBeTruthy();

    const emitidos: string[] = [];
    fixture.componentInstance.retryVerifactu.subscribe((id) => emitidos.push(id));
    reintentar!.click();
    expect(emitidos).toEqual(['id-F-1']);
  });

  it('error AEAT: muestra código y descripción', async () => {
    await montar([
      factura('F-2', { estado: 'error', tipoRegistro: 'alta', errorKind: 'aeat', codigoError: '1100', descripcionError: 'Valor incorrecto' }),
    ]);
    expect(texto(fila('F-2'))).toContain('AEAT 1100: Valor incorrecto');
  });

  it('en_cola: etiqueta visible y anunciada con role=status, sin edición, con Reintentar (S9.4, S9.6)', async () => {
    await montar([
      factura('F-3', { estado: 'en_cola', tipoRegistro: 'alta', encoladoAt: '2026-10-01T09:58:00Z' }),
    ]);
    const row = fila('F-3');

    const estado = row.querySelector('[role="status"]');
    expect(estado).toBeTruthy();
    expect(texto(estado!)).toContain('En cola');
    expect(texto(estado!)).toContain('Esperando al registro anterior · hace 2 min');
    expect(botonPorEtiqueta(row, /^Editar factura/)).toBeUndefined();
    expect(botonPorEtiqueta(row, /Cambiar número/)).toBeUndefined();
    expect(botonPorEtiqueta(row, /Reintentar.*F-3/)).toBeTruthy();
  });

  it('pendiente: intentos y antigüedad, sin edición, con Reintentar (S9.2, S9.6)', async () => {
    await montar([
      factura('F-4', { estado: 'pendiente', tipoRegistro: 'alta', attempts: 3, generadoAt: '2026-10-01T09:30:00Z' }),
    ]);
    const row = fila('F-4');

    expect(texto(row)).toContain('Pendiente de AEAT');
    expect(texto(row)).toContain('Intento 3 · hace 30 min');
    expect(botonPorEtiqueta(row, /^Editar factura/)).toBeUndefined();
    expect(botonPorEtiqueta(row, /Reintentar.*F-4/)).toBeTruthy();
  });

  it('enviado: muestra el CSV, sin Reintentar y sin edición', async () => {
    await montar([factura('F-5', { estado: 'enviado', tipoRegistro: 'alta', csv: 'CSV-ABC-123' })]);
    const row = fila('F-5');

    expect(texto(row)).toContain('Registrada en AEAT');
    expect(texto(row)).toContain('CSV-ABC-123');
    expect(botonPorEtiqueta(row, /Reintentar/)).toBeUndefined();
    expect(botonPorEtiqueta(row, /^Editar factura/)).toBeUndefined();
  });

  it('enviado con aceptadoConErrores: aviso con código y descripción (S9.3)', async () => {
    await montar([
      factura('F-6', {
        estado: 'enviado',
        tipoRegistro: 'alta',
        csv: 'C1',
        aceptadoConErrores: true,
        codigoError: '4102',
        descripcionError: 'El XML no cumple el esquema',
      }),
    ]);
    const row = fila('F-6');

    expect(texto(row)).toContain('Aceptada con errores');
    expect(texto(row)).toContain('AEAT 4102: El XML no cumple el esquema');
  });

  it('tras un error la factura vuelve a ser editable y renumerable (S9.6)', async () => {
    await montar([factura('F-7', { estado: 'error', tipoRegistro: 'alta', errorMessage: 'Falta NIF' })]);
    const row = fila('F-7');

    expect(botonPorEtiqueta(row, /^Editar factura/)).toBeTruthy();
    expect(botonPorEtiqueta(row, /Cambiar número/)).toBeTruthy();
  });

  it('sin Verifactu: guion, editable y sin Reintentar', async () => {
    await montar([factura('F-8')]);
    const row = fila('F-8');

    expect(row.querySelector('[role="status"]')).toBeNull();
    expect(botonPorEtiqueta(row, /^Editar factura/)).toBeTruthy();
    expect(botonPorEtiqueta(row, /Reintentar/)).toBeUndefined();
  });

  it('factura anulada con la anulación en error: muestra el error de la anulación y permite reintentar', async () => {
    await montar([
      factura('F-9', { estado: 'enviado', tipoRegistro: 'alta', csv: 'ALTA', anulacion: { estado: 'error', errorMessage: 'AEAT no disponible' } }, { status: 'anulada' }),
    ]);
    const row = fila('F-9');

    expect(texto(row)).toContain('Error en anulación');
    expect(texto(row)).toContain('AEAT no disponible');
    expect(botonPorEtiqueta(row, /Reintentar.*F-9/)).toBeTruthy();
  });

  it('no tiene violaciones de axe en las filas con todos los estados', async () => {
    await montar([
      factura('F-1', { estado: 'error', tipoRegistro: 'alta', errorMessage: 'Falta NIF' }),
      factura('F-3', { estado: 'en_cola', tipoRegistro: 'alta', encoladoAt: '2026-10-01T09:58:00Z' }),
      factura('F-4', { estado: 'pendiente', tipoRegistro: 'alta', attempts: 1 }),
      factura('F-5', { estado: 'enviado', tipoRegistro: 'alta', csv: 'C' }),
      factura('F-6', { estado: 'enviado', tipoRegistro: 'alta', csv: 'C', aceptadoConErrores: true, codigoError: '4102', descripcionError: 'x' }),
      factura('F-8'),
    ]);
    const tbody = el().querySelector('tbody')!;
    const violaciones = await analizarA11y(tbody);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
