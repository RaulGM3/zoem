import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturacionArchivoTabComponent } from './facturacion-archivo-tab';
import type { Invoice } from '../../../../core/services/invoice.service';
import type { VerifactuEstado } from '../../../../interfaces/verifactu.interface';
import type { Caso } from '../../../../interfaces';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

function caso(id: string, facturaId?: string): Caso {
  return {
    id,
    titulo: `Caso ${id}`,
    tipo: 'Legal',
    facturaId,
    resumenFinanciero: { saldo: 100 },
  } as unknown as Caso;
}

function factura(id: string, verifactu?: VerifactuEstado, override: Partial<Invoice> = {}): Invoice {
  return {
    id,
    companyId: 'c-1',
    invoiceNumber: `F-${id}`,
    amount: 100,
    vat: 21,
    total: 121,
    status: 'pendiente',
    issueDate: '2026-09-01',
    dueDate: '2026-10-01',
    verifactu,
    ...override,
  };
}

describe('FacturacionArchivoTabComponent — Verifactu (R9.2, R9.3)', () => {
  let fixture: ComponentFixture<FacturacionArchivoTabComponent>;

  const el = (): HTMLElement => fixture.nativeElement;
  const texto = (e: Element): string => e.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const botonReintentar = (): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      /Reintentar/.test(b.getAttribute('aria-label') ?? texto(b)),
    );

  async function montar(facturas: Invoice[]): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [FacturacionArchivoTabComponent] }).compileComponents();
    fixture = TestBed.createComponent(FacturacionArchivoTabComponent);
    fixture.componentRef.setInput('casos', facturas.map((f) => caso(`caso-${f.id}`, f.id)));
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('canReabrir', false);
    fixture.componentRef.setInput('invoiceMap', new Map(facturas.map((f) => [f.id, f])));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('error: muestra el mensaje y Reintentar emite el id de la factura (S9.2)', async () => {
    await montar([factura('f1', { estado: 'error', tipoRegistro: 'alta', errorMessage: 'Falta el NIF del cliente' })]);

    expect(texto(el())).toContain('Falta el NIF del cliente');
    const emitidos: string[] = [];
    fixture.componentInstance.retryVerifactu.subscribe((id) => emitidos.push(id));
    expect(botonReintentar()).toBeTruthy();
    botonReintentar()!.click();
    expect(emitidos).toEqual(['f1']);
  });

  it('pendiente: intentos y antigüedad, con Reintentar', async () => {
    await montar([
      factura('f2', { estado: 'pendiente', tipoRegistro: 'alta', attempts: 2, generadoAt: '2026-10-01T09:45:00Z' }),
    ]);

    expect(texto(el())).toContain('Pendiente de AEAT');
    expect(texto(el())).toContain('Intento 2 · hace 15 min');
    expect(botonReintentar()).toBeTruthy();
  });

  it('en_cola: etiqueta como texto plano (sin región viva por fila) y Reintentar', async () => {
    await montar([factura('f3', { estado: 'en_cola', tipoRegistro: 'alta', encoladoAt: '2026-10-01T09:59:00Z' })]);

    expect(texto(el())).toContain('En cola');
    const vivas = el().querySelectorAll('[role="status"]');
    expect(vivas).toHaveLength(1);
    expect(texto(vivas[0]!)).toBe('');
    expect(botonReintentar()).toBeTruthy();
  });

  it('al reintentar anuncia en la región viva única y luego el nuevo estado', async () => {
    await montar([factura('f1', { estado: 'error', tipoRegistro: 'alta', errorMessage: 'AEAT no disponible' })]);
    const viva = el().querySelector('[role="status"]')!;

    botonReintentar()!.click();
    fixture.detectChanges();
    expect(texto(viva)).toBe('Reintentando el envío a Verifactu del caso Caso caso-f1');

    const enviada = factura('f1', { estado: 'enviado', tipoRegistro: 'alta', csv: 'C1' });
    fixture.componentRef.setInput('invoiceMap', new Map([[enviada.id, enviada]]));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(texto(viva)).toBe('Caso Caso caso-f1: Registrada en AEAT');
  });

  it('enviado: CSV visible y sin Reintentar', async () => {
    await montar([factura('f4', { estado: 'enviado', tipoRegistro: 'alta', csv: 'CSV-XYZ' })]);

    expect(texto(el())).toContain('Registrada en AEAT');
    expect(texto(el())).toContain('CSV-XYZ');
    expect(botonReintentar()).toBeUndefined();
  });

  it('enviado con aceptadoConErrores: muestra el aviso', async () => {
    await montar([
      factura('f5', {
        estado: 'enviado',
        tipoRegistro: 'alta',
        aceptadoConErrores: true,
        codigoError: '4102',
        descripcionError: 'El XML no cumple el esquema',
      }),
    ]);

    expect(texto(el())).toContain('AEAT 4102: El XML no cumple el esquema');
  });

  it('caso con factura sin Verifactu: no muestra estado ni Reintentar', async () => {
    await montar([factura('f6')]);

    expect(texto(el().querySelector('[role="status"]')!)).toBe('');
    expect(el().textContent).not.toContain('Registrada en AEAT');
    expect(botonReintentar()).toBeUndefined();
  });

  it('no tiene violaciones de axe en las filas con estados de Verifactu', async () => {
    await montar([
      factura('f1', { estado: 'error', tipoRegistro: 'alta', errorMessage: 'Falta NIF' }),
      factura('f2', { estado: 'pendiente', tipoRegistro: 'alta', attempts: 1 }),
      factura('f4', { estado: 'enviado', tipoRegistro: 'alta', csv: 'C' }),
    ]);
    const violaciones = [
      ...(await analizarA11y(el().querySelector('tbody')!)),
      ...(await analizarA11y(el().querySelector('[role="status"]')!)),
    ];
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
