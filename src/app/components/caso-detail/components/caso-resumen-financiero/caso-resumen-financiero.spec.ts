import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CasoResumenFinancieroComponent } from './caso-resumen-financiero';
import type { MovimientoGestoria } from '../../../../interfaces';

const MOVS = [
  { id: 'm1', concepto: 'Provisión de fondos', tipo: 'ingreso', fecha: '2026-03-01', importe: 1000, esEntrada: true, cuentaId: 'cu1', createdBy: 'u1', baseImponible: 826.45, cuotaIva: 173.55, tipoIva: 21 },
  { id: 'm2', concepto: 'Tasa 696', notas: 'Juzgado nº 3', tipo: 'suplido', fecha: '2026-03-05', importe: 150, esEntrada: false, createdBy: 'u2', updatedBy: 'u1', ivaExento: true },
  { id: 'm3', concepto: 'Minuta', tipo: 'honorario', fecha: '2026-02-10', importe: 300, esEntrada: false, cuentaId: 'cu2', createdBy: 'u1', baseImponible: 247.93, cuotaIva: 52.07 },
  { id: 'm4', concepto: 'Mensajería', tipo: 'gasto', fecha: '2026-03-03', importe: 50, esEntrada: false, cuentaId: 'cu1', createdBy: 'desconocido' },
] as unknown as MovimientoGestoria[];

describe('CasoResumenFinancieroComponent', () => {
  let fixture: ComponentFixture<CasoResumenFinancieroComponent>;
  let component: CasoResumenFinancieroComponent;

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(selector: string, raiz: HTMLElement = el()): T => {
    const found = raiz.querySelector<T>(selector);
    expect(found, selector).toBeTruthy();
    return found!;
  };
  const qa = <T extends HTMLElement>(selector: string, raiz: HTMLElement = el()): T[] =>
    Array.from(raiz.querySelectorAll<T>(selector));
  const texto = (e: Element): string => e.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  /** Texto sin ningún espacio: para comparar contenido sin depender del formato del template. */
  const compacto = (e: Element | string): string => (typeof e === 'string' ? e : e.textContent ?? '').replace(/\s+/g, '');

  function set(inputs: Record<string, unknown>): void {
    for (const [nombre, valor] of Object.entries(inputs)) fixture.componentRef.setInput(nombre, valor);
    fixture.detectChanges();
  }

  function click(target: HTMLElement | undefined | null): void {
    expect(target).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CasoResumenFinancieroComponent] }).compileComponents();
    fixture = TestBed.createComponent(CasoResumenFinancieroComponent);
    component = fixture.componentInstance;
    set({ movimientos: MOVS });
  });

  const kpi = (titulo: string): HTMLElement | undefined =>
    qa('.kpi-card').find(k => texto(q('p', k)) === titulo);
  const importe = (titulo: string): string => texto(q('p.text-xl', kpi(titulo)!));
  const disparador = (): HTMLButtonElement => q('#egresos-desglose-trigger');
  const desglose = (): HTMLElement => q('#egresos-desglose');

  it('calcula ingresos, egresos, honorarios y saldo a partir de los movimientos', () => {
    expect(importe('Ingresos')).toBe('1,000.00 €');
    expect(importe('Egresos')).toBe('500.00 €');
    expect(importe('Honorarios')).toBe('300.00 €');
    expect(importe('Saldo neto del caso')).toBe('500.00 €');
    expect(q('p.text-xl', kpi('Saldo neto del caso')!).style.color).toBe('var(--success)');
    expect(kpi('Ingresos')!.parentElement!.className).toContain('lg:grid-cols-4');
  });

  it('sin honorarios omite su tarjeta y el saldo negativo va en rojo', () => {
    set({ movimientos: [MOVS[1]] });
    expect(kpi('Honorarios')).toBeUndefined();
    expect(kpi('Ingresos')!.parentElement!.className).toContain('lg:grid-cols-3');
    expect(importe('Saldo neto del caso')).toBe('-150.00 €');
    expect(q('p.text-xl', kpi('Saldo neto del caso')!).style.color).toBe('var(--danger)');
  });

  it('sin egresos no hay desglose', () => {
    set({ movimientos: [MOVS[0]] });
    expect(el().querySelector('#egresos-desglose-trigger')).toBeNull();
    expect(el().querySelector('#egresos-desglose')).toBeNull();
  });

  it('el desglose lista cada tipo con su importe y su peso', () => {
    expect(qa('button', desglose()).map(compacto)).toEqual([
      'Suplidos150.00€30%', 'Honorarios300.00€60%', 'Gastos50.00€10%',
    ]);
  });

  it('el desglose se abre con clic, hover o foco y se cierra con Escape o al salir', () => {
    expect(desglose().hidden).toBe(true);
    click(disparador());
    expect(desglose().hidden).toBe(false);
    expect(disparador().getAttribute('aria-expanded')).toBe('true');
    click(disparador());
    expect(desglose().hidden).toBe(true);

    disparador().dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(desglose().hidden).toBe(false);
    kpi('Egresos')!.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(desglose().hidden).toBe(true);

    disparador().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(desglose().hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(desglose().hidden).toBe(true);
  });

  it('pulsar un tipo del desglose lo emite y cierra el desglose', () => {
    const emitidos: string[] = [];
    component.tipoSeleccionado.subscribe(t => emitidos.push(t));
    click(disparador());
    click(q('[aria-label="Filtrar movimientos por Honorarios"]'));
    expect(emitidos).toEqual(['honorario']);
    expect(desglose().hidden).toBe(true);
  });

  it('muestra el IVA del caso solo si hay cuotas', () => {
    const iva = (): HTMLElement | undefined => qa('.rounded-xl').find(b => texto(b).startsWith('IVA del caso'));
    expect(compacto(iva()!)).toBe(compacto('IVA del caso Repercutido 173.55 € Soportado 52.07 € Liquidación 121.48 €'));
    set({ movimientos: [MOVS[1], MOVS[3]] });
    expect(iva()).toBeUndefined();
  });
});
