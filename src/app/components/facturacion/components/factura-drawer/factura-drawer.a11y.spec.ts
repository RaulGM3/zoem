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
