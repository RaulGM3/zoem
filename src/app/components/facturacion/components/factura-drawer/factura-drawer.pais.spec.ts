import { describe, it, expect } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturaDrawerComponent, type InvoiceFormPayload } from './factura-drawer';
import type { InvoiceLinea } from '../../../../core/services/invoice.service';
import type { ClienteFactura } from '../../../../core/facturacion/cliente-factura';
import { provideMonedaTest } from '../../../../core/moneda/moneda-empresa.testing';
import { provideFiscalTest } from '../../../../core/fiscal/fiscal-empresa.testing';

const linea = (p: Partial<InvoiceLinea> = {}): InvoiceLinea => ({
  concepto: 'Honorarios', cantidad: 1, precioUnitario: 100, base: 100, aplicaIva: true, ...p,
});

describe('FacturaDrawerComponent — IVA y documentos por país', () => {
  let fixture: ComponentFixture<FacturaDrawerComponent>;
  let emitidos: InvoiceFormPayload[];
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const ivaLinea = (i: number): HTMLSelectElement =>
    raiz().querySelector<HTMLSelectElement>(`select[aria-label="Tipo de IVA línea ${i + 1}"]`)!;
  const opciones = (i: number): string[] => Array.from(ivaLinea(i).options).map((o) => (o.textContent ?? '').trim());
  const causas = (): HTMLSelectElement[] => Array.from(raiz().querySelectorAll<HTMLSelectElement>('select[id^="causa-exencion-"]'));

  async function estabilizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function montar(
    pais: string,
    lineas: InvoiceLinea[] = [],
    cliente: ClienteFactura = { nombre: 'Cliente', tipoId: 'nif' },
    defaultIvaRate = 21,
  ): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [provideMonedaTest({ pais }), provideFiscalTest({ pais })],
      imports: [FacturaDrawerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(FacturaDrawerComponent);
    fixture.componentRef.setInput('initialLineas', lineas);
    fixture.componentRef.setInput('defaultIvaRate', defaultIvaRate);
    fixture.componentRef.setInput('initialCliente', cliente);
    emitidos = [];
    fixture.componentInstance.confirmed.subscribe((p) => emitidos.push(p));
    await estabilizar();
  }

  async function confirmar(): Promise<void> {
    Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) => /Generar factura/.test(b.textContent ?? ''))!.click();
    await estabilizar();
  }

  it('España: la línea añadida nace al 10 % y ofrece 21/10/4/exento', async () => {
    await montar('ES', [linea({ ivaRate: 0.21 })]);
    fixture.componentInstance.addLinea();
    await estabilizar();
    expect(opciones(1)).toEqual(['21%', '10%', '4%', 'Exento (0%)']);
    expect((ivaLinea(1).selectedOptions[0].textContent ?? '').trim()).toBe('10%');
  });

  it('México: ofrece 16/8/exento y la línea añadida nace al 16 %', async () => {
    await montar('MX', [linea({ ivaRate: 0.16 })], { nombre: 'Cliente', tipoId: 'nif' }, 16);
    fixture.componentInstance.addLinea();
    await estabilizar();
    expect(opciones(1)).toEqual(['16%', '8%', 'Exento (0%)']);
    expect((ivaLinea(1).selectedOptions[0].textContent ?? '').trim()).toBe('16%');
  });

  it('México: una línea guardada al 21 % la conserva como opción y no se cambia en silencio', async () => {
    await montar('MX', [linea({ ivaRate: 0.21 })], { nombre: 'Cliente', tipoId: 'nif' }, 21);
    expect(opciones(0)).toContain('21%');
    expect((ivaLinea(0).selectedOptions[0].textContent ?? '').trim()).toBe('21%');
  });

  it('México: una línea exenta no pide ni muestra causa de exención y se emite sin causa', async () => {
    await montar('MX', [linea({ ivaRate: 0 })], { nombre: 'Cliente', tipoId: 'nif' }, 16);
    expect(causas()).toHaveLength(0);
    await confirmar();
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].lineas[0].causaExencion).toBeUndefined();
  });

  it('España: la línea exenta sigue mostrando y exigiendo la causa', async () => {
    await montar('ES', [linea({ ivaRate: 0 })]);
    expect(causas()).toHaveLength(1);
    await confirmar();
    expect(emitidos).toHaveLength(0);
  });

  it('México: el documento se llama RFC y se valida por su forma, no con el dígito español', async () => {
    await montar('MX', [linea({ ivaRate: 0.16 })], { nombre: 'Cliente', tipoId: 'nif', nif: 'XAXX010101000' }, 16);
    expect(raiz().querySelector('#cliente-tipoId option[value="nif"]')?.textContent).toContain('RFC');
    await confirmar();
    expect(emitidos).toHaveLength(1);
  });

  it('México: un RFC con forma inválida bloquea', async () => {
    await montar('MX', [linea({ ivaRate: 0.16 })], { nombre: 'Cliente', tipoId: 'nif', nif: '123' }, 16);
    await confirmar();
    expect(emitidos).toHaveLength(0);
  });

  it('España: el NIF con dígito de control incorrecto sigue bloqueando', async () => {
    await montar('ES', [linea()], { nombre: 'Cliente', tipoId: 'nif', nif: '12345678A' });
    await confirmar();
    expect(emitidos).toHaveLength(0);
  });
});
