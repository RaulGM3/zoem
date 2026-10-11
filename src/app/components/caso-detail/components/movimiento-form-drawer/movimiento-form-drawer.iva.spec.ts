import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideFiscalTest } from '../../../../core/fiscal/fiscal-empresa.testing';
import { provideMonedaTest } from '../../../../core/moneda/moneda-empresa.testing';
import { MovimientoFormDrawerComponent, type MovimientoFormData } from './movimiento-form-drawer';
import type { MovimientoGestoria } from '../../../../interfaces';

async function montar(pais: string, edit: Partial<MovimientoGestoria> | null = null): Promise<ComponentFixture<MovimientoFormDrawerComponent>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [MovimientoFormDrawerComponent],
    providers: [provideMonedaTest({ pais }), provideFiscalTest({ pais })],
  }).compileComponents();
  const f = TestBed.createComponent(MovimientoFormDrawerComponent);
  f.componentRef.setInput('visible', true);
  f.componentRef.setInput('saving', false);
  f.componentRef.setInput('prefillSlot', null);
  f.componentRef.setInput('movimientoEdit', edit as MovimientoGestoria | null);
  f.detectChanges();
  await f.whenStable();
  return f;
}

const opciones = (f: ComponentFixture<unknown>): string[] =>
  Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>('#mov-iva option')).map((o) => o.value);

describe('MovimientoFormDrawerComponent — IVA por país', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('España: 21, 10, 4, 0 y exento; nace al 21', async () => {
    const f = await montar('ES');
    expect(opciones(f)).toEqual(['21', '10', '4', '0', 'exento']);
    expect(f.componentInstance.formIva()).toBe('21');
  });

  it('México: 16, 8, 0 y exento; nace al 16', async () => {
    const f = await montar('MX');
    expect(opciones(f)).toEqual(['16', '8', '0', 'exento']);
    expect(f.componentInstance.formIva()).toBe('16');
  });

  it('emite el tipo del país (México 16 %)', async () => {
    const f = await montar('MX');
    const out: MovimientoFormData[] = [];
    f.componentInstance.saved.subscribe((d) => out.push(d));
    f.componentInstance.formConcepto.set('Honorarios');
    f.componentInstance.formImporte.set('116');
    f.componentInstance.formIvaIncluido.set(true);
    f.componentInstance.submit();
    expect(out[0]).toMatchObject({ tipoIva: 16, baseImponible: 100, cuotaIva: 16 });
  });

  it('editar un movimiento con 21 % en una empresa de México conserva el 21 como opción seleccionada', async () => {
    const f = await montar('MX', { id: 'm', tipo: 'gasto', concepto: 'X', importe: 121, esEntrada: false, fecha: '2026-01-01', tipoIva: 21, ivaExento: false, baseImponible: 100, cuotaIva: 21 });
    expect(opciones(f)).toEqual(['21', '16', '8', '0', 'exento']);
    expect(f.componentInstance.formIva()).toBe('21');
  });
});
