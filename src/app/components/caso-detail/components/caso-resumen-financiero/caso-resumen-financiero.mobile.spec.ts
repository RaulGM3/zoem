import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CasoResumenFinancieroComponent } from './caso-resumen-financiero';
import type { MovimientoGestoria } from '../../../../interfaces';
import { mockViewport } from '../../mock-viewport';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const MOVS = [
  { id: 'm1', concepto: 'Provisión', tipo: 'ingreso', fecha: '2026-03-01', importe: 1000, esEntrada: true, createdBy: 'u1', baseImponible: 826.45, cuotaIva: 173.55, tipoIva: 21 },
  { id: 'm2', concepto: 'Tasa', tipo: 'suplido', fecha: '2026-03-05', importe: 150, esEntrada: false, createdBy: 'u2', ivaExento: true },
  { id: 'm3', concepto: 'Minuta', tipo: 'honorario', fecha: '2026-02-10', importe: 300, esEntrada: false, createdBy: 'u1' },
] as unknown as MovimientoGestoria[];

describe('CasoResumenFinancieroComponent — móvil', () => {
  let fixture: ComponentFixture<CasoResumenFinancieroComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const disparador = (): HTMLButtonElement => el().querySelector<HTMLButtonElement>('#egresos-desglose-trigger')!;
  const desglose = (): HTMLElement => el().querySelector<HTMLElement>('#egresos-desglose')!;

  async function montar(mobile: boolean): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [CasoResumenFinancieroComponent] });
    fixture = TestBed.createComponent(CasoResumenFinancieroComponent);
    fixture.componentRef.setInput('movimientos', MOVS);
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('los KPIs se apilan en una columna en móvil y pasan a dos desde sm', async () => {
    await montar(true);
    const grid = el().querySelector('.kpi-card')!.parentElement!;
    expect(grid.classList.contains('grid-cols-1')).toBe(true);
    expect(grid.classList.contains('sm:grid-cols-2')).toBe(true);
    expect(grid.classList.contains('grid-cols-2')).toBe(false);
  });

  it('móvil: un toque (mouseenter + foco + clic) abre el desglose y no lo cierra', async () => {
    await montar(true);
    disparador().dispatchEvent(new Event('mouseenter'));
    disparador().dispatchEvent(new Event('focus'));
    disparador().click();
    fixture.detectChanges();
    expect(desglose().hidden).toBe(false);
    disparador().click();
    fixture.detectChanges();
    expect(desglose().hidden).toBe(true);
  });

  it('escritorio: mouseenter y foco abren el desglose', async () => {
    await montar(false);
    disparador().dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(desglose().hidden).toBe(false);
  });

  it('el disparador tiene área táctil', async () => {
    await montar(true);
    expect(disparador().classList.contains('max-sm:tap-target')).toBe(true);
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
