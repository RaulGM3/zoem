import { vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { FacturacionGastosTabComponent } from '../app/components/facturacion/components/facturacion-gastos-tab/facturacion-gastos-tab';
import { FacturasRecibidasService } from '../app/core/services/facturas-recibidas.service';
import { ToastService } from '../app/core/services/toast.service';
import type { FacturaRecibida } from '../app/interfaces/factura-recibida.interface';

export function mockViewport(mobile: boolean): void {
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

export function factura(over: Partial<FacturaRecibida> & { id: string }): FacturaRecibida {
  return {
    companyId: 'co',
    numeroRecepcion: 1,
    tipoFactura: 'F1',
    claveOperacion: '01',
    proveedor: { nombre: 'Proveedor SL', nif: 'B12345674' },
    numero: 'F-' + over.id,
    fechaExpedicion: '2026-04-02',
    fechaRegistro: '2026-04-05',
    periodo303: { ejercicio: 2026, trimestre: 2 },
    lineasIva: [{ base: 100, tipo: 21, cuota: 21 }],
    total: 121,
    porcentajeDeducible: 100,
    concepto: 'Material',
    qrValidacion: { estado: 'sin_qr' },
    extraccion: { origen: 'manual', discrepancias: [] },
    estado: 'registrada',
    createdBy: 'u1',
    ...over,
  } as FacturaRecibida;
}

export const FACTURAS: FacturaRecibida[] = [
  factura({ id: 'A', numeroRecepcion: 1 }),
  factura({ id: 'B', numeroRecepcion: 2, lineasIva: [{ base: 100, tipo: 10, cuota: 10 }], total: 110, porcentajeDeducible: 50 }),
  factura({ id: 'C', numeroRecepcion: 3, periodo303: { ejercicio: 2026, trimestre: 1 } }),
  factura({ id: 'D', numeroRecepcion: 4, estado: 'anulada' }),
];

export interface FakeSvc {
  facturas: WritableSignal<FacturaRecibida[]>;
  cargando: WritableSignal<boolean>;
  cargar: ReturnType<typeof vi.fn>;
  registrar: ReturnType<typeof vi.fn>;
  anular: ReturnType<typeof vi.fn>;
}

export function crearFake(lista: FacturaRecibida[] = FACTURAS): FakeSvc {
  return {
    facturas: signal(lista),
    cargando: signal(false),
    cargar: vi.fn().mockResolvedValue(undefined),
    registrar: vi.fn().mockResolvedValue({ id: 'x', numeroRecepcion: 9, reactivada: false }),
    anular: vi.fn().mockResolvedValue(undefined),
  };
}

export async function montarTab(fake: FakeSvc, mobile = false) {
  TestBed.resetTestingModule();
  mockViewport(mobile);
  const toast = { success: vi.fn(), fromError: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [FacturacionGastosTabComponent],
    providers: [
      { provide: FacturasRecibidasService, useValue: fake },
      { provide: ToastService, useValue: toast },
    ],
  }).compileComponents();
  const fixture: ComponentFixture<FacturacionGastosTabComponent> = TestBed.createComponent(FacturacionGastosTabComponent);
  fixture.componentRef.setInput('fechaHoy', '2026-04-05');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, toast };
}
