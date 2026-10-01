import { describe, it, expect } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturaDrawerComponent } from './factura-drawer';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';
import type { InvoiceLinea } from '../../../../core/services/invoice.service';

const LINEAS_EXENTAS: InvoiceLinea[] = [
  { concepto: 'Suplido', cantidad: 1, precioUnitario: 50, base: 50, aplicaIva: true, ivaRate: 0 },
  { concepto: 'Honorarios', cantidad: 1, precioUnitario: 100, base: 100, aplicaIva: true, ivaRate: 0.21 },
];

async function montar(lineas: InvoiceLinea[]): Promise<ComponentFixture<FacturaDrawerComponent>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({ imports: [FacturaDrawerComponent] }).compileComponents();
  const fixture = TestBed.createComponent(FacturaDrawerComponent);
  fixture.componentRef.setInput('initialLineas', lineas);
  fixture.componentRef.setInput('initialCliente', { nombre: 'Cliente Test', tipoId: 'nif' });
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('FacturaDrawerComponent — accesibilidad (axe), causa de exención (S10.6)', () => {
  it('sin violaciones con el campo de causa visible', async () => {
    const fixture = await montar(LINEAS_EXENTAS);
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('select[id^="causa-exencion-"]')).toHaveLength(1);

    const violaciones = await analizarA11y(raiz);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });

  it('sin violaciones con el campo en estado de error (aria-invalid + aria-describedby)', async () => {
    const fixture = await montar(LINEAS_EXENTAS);
    const raiz = fixture.nativeElement as HTMLElement;
    const confirmar = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      /Generar factura/.test(b.textContent ?? ''),
    )!;
    confirmar.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const select = raiz.querySelector<HTMLSelectElement>('select[id^="causa-exencion-"]')!;
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('causa de exención');

    const violaciones = await analizarA11y(raiz);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});

describe('FacturaDrawerComponent — accesibilidad (axe), sección Cliente (S4.12 sin buscador)', () => {
  it('sin violaciones con la sección Cliente y el contacto vinculado', async () => {
    const fixture = await montar(LINEAS_EXENTAS);
    fixture.componentRef.setInput('verifactuEnabled', true);
    fixture.componentRef.setInput('initialCliente', { contactoId: 'c-1', nombre: 'Ana', tipoId: 'extranjero', nif: 'PA1' });
    fixture.componentRef.setInput('contactoVinculado', { id: 'c-1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'P', nifType: 'pasaporte', nif: 'PA1' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('#cliente-nombre')).not.toBeNull();
    expect(raiz.querySelector('[role="status"]')).not.toBeNull();

    const violaciones = await analizarA11y(raiz);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });

  it('sin violaciones con los errores del cliente visibles (nombre vacío, NIF inválido)', async () => {
    const fixture = await montar([{ concepto: 'H', cantidad: 1, precioUnitario: 100, base: 100, aplicaIva: true }]);
    fixture.componentRef.setInput('initialCliente', { nombre: '', tipoId: 'nif', nif: '12345678A' });
    fixture.detectChanges();
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    Array.from(raiz.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => /Generar factura/.test(b.textContent ?? ''))!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(raiz.querySelector('#cliente-nombre-error')).not.toBeNull();
    expect(raiz.querySelector('#cliente-nif-error')).not.toBeNull();
    const violaciones = await analizarA11y(raiz);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
