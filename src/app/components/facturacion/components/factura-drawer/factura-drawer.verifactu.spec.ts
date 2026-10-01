import { describe, it, expect } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturaDrawerComponent } from './factura-drawer';
import type { Invoice } from '../../../../core/services/invoice.service';
import type { VerifactuEstado } from '../../../../interfaces/verifactu.interface';

function factura(verifactu?: VerifactuEstado): Invoice {
  return {
    id: 'inv-1',
    companyId: 'c-1',
    invoiceNumber: 'F-2026-0001',
    amount: 100,
    vat: 21,
    total: 121,
    status: 'pendiente',
    issueDate: '2026-09-01',
    dueDate: '2026-10-01',
    verifactu,
  };
}

describe('FacturaDrawerComponent — bloqueo por Verifactu (R9.4, S9.6)', () => {
  let fixture: ComponentFixture<FacturaDrawerComponent>;

  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const confirmar = (): HTMLButtonElement => {
    const raiz = fixture.nativeElement as HTMLElement;
    const b = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button')).find((x) =>
      /Guardar cambios/.test(x.textContent ?? ''),
    );
    expect(b, 'botón Guardar cambios').toBeTruthy();
    return b!;
  };

  async function montar(editing: Invoice | null): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [FacturaDrawerComponent] }).compileComponents();
    fixture = TestBed.createComponent(FacturaDrawerComponent);
    fixture.componentRef.setInput('editMode', true);
    fixture.componentRef.setInput('editingInvoice', editing);
    fixture.componentRef.setInput('verifactuEnabled', true);
    fixture.componentRef.setInput('initialLineas', [
      { concepto: 'Honorarios', cantidad: 1, precioUnitario: 100, base: 100, aplicaIva: true },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('enviado: banner "ya registrada" y no se puede guardar', async () => {
    await montar(factura({ estado: 'enviado', tipoRegistro: 'alta', csv: 'C' }));
    expect(texto()).toContain('ya registrada en Verifactu');
    expect(confirmar().disabled).toBe(true);
  });

  it.each(['pendiente', 'en_cola'] as const)('%s: banner de registro en curso y no se puede guardar', async (estado) => {
    await montar(factura({ estado, tipoRegistro: 'alta' }));
    expect(texto()).toContain('registro Verifactu en curso');
    expect(confirmar().disabled).toBe(true);
  });

  it('error: editable, sin banner de bloqueo y se puede guardar', async () => {
    await montar(factura({ estado: 'error', tipoRegistro: 'alta', errorMessage: 'Falta NIF' }));
    expect(texto()).not.toContain('en curso');
    expect(texto()).not.toContain('ya registrada');
    expect(confirmar().disabled).toBe(false);
  });
});
