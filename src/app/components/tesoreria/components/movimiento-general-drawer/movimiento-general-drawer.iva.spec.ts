import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideFiscalTest } from '../../../../core/fiscal/fiscal-empresa.testing';
import { provideMonedaTest } from '../../../../core/moneda/moneda-empresa.testing';
import { CuentasService } from '../../../../core/services/cuentas.service';
import { GestoriaService } from '../../../../core/services/gestoria.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { MovimientoGestoria } from '../../../../interfaces';
import { MovimientoGeneralDrawerComponent } from './movimiento-general-drawer';

async function montar(pais: string, editando: Partial<MovimientoGestoria> | null = null): Promise<ComponentFixture<MovimientoGeneralDrawerComponent>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [MovimientoGeneralDrawerComponent],
    providers: [
      provideMonedaTest({ pais }),
      provideFiscalTest({ pais }),
      { provide: GestoriaService, useValue: {} },
      { provide: CuentasService, useValue: { cuentas: signal([]) } },
      { provide: ToastService, useValue: { run: vi.fn() } },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(MovimientoGeneralDrawerComponent);
  f.componentRef.setInput('visible', true);
  f.componentRef.setInput('editando', editando as MovimientoGestoria | null);
  f.detectChanges();
  await f.whenStable();
  return f;
}

const opciones = (f: ComponentFixture<unknown>): string[] =>
  Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>('#mg-iva option')).map((o) => o.value);

describe('MovimientoGeneralDrawerComponent — IVA por país', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('España: 21, 10, 4, 0 y exento; el gasto nace al 21', async () => {
    const f = await montar('ES');
    expect(opciones(f)).toEqual(['21', '10', '4', '0', 'exento']);
    expect(f.componentInstance.formIva()).toBe('21');
  });

  it('Chile: 19, 0 y exento; nace al 19', async () => {
    const f = await montar('CL');
    expect(opciones(f)).toEqual(['19', '0', 'exento']);
    expect(f.componentInstance.formIva()).toBe('19');
  });

  it('los suplidos/ajustes siguen exentos', async () => {
    const f = await montar('CO');
    f.componentInstance.onTipoChange('ajuste');
    expect(f.componentInstance.formIva()).toBe('exento');
  });

  it('editar un movimiento al 21 % en una empresa de México conserva el 21 (no lo cambia en silencio)', async () => {
    const f = await montar('MX', { id: 'm', tipo: 'gasto', concepto: 'X', importe: 121, esEntrada: false, fecha: '2026-01-01', baseImponible: 100, cuotaIva: 21 });
    expect(f.componentInstance.formIva()).toBe('21');
    expect(opciones(f)).toContain('21');
  });
});
