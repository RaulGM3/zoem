import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Timestamp } from '@angular/fire/firestore';
import { TesoreriaResumenTabComponent, type CotejoCuenta, type MovimientoEnriquecido } from './resumen-tab';
import type { CierreCaja, CuentaBancaria } from '../../../../interfaces';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

function mockViewport(mobile: boolean): void {
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

const AHORA = Timestamp.fromDate(new Date('2026-01-15T10:00:00Z'));

function cuenta(id: string, o: Partial<CuentaBancaria> = {}): CuentaBancaria {
  return { id, companyId: 'c-1', nombre: `Cuenta ${id}`, tipo: 'banco', entidad: 'BBVA', activa: true, createdAt: AHORA, ...o };
}

function cotejo(id: string, o: Partial<CotejoCuenta> = {}): CotejoCuenta {
  return {
    cuenta: cuenta(id), ingresos: 1000, egresos: 250, sistema: 750, proyeccion: 800,
    banco: 750, diferencia: 0, conciliado: true, ...o,
  };
}

function mov(id: string, o: Partial<MovimientoEnriquecido> = {}): MovimientoEnriquecido {
  return {
    id, companyId: 'c-1', tipo: 'gasto', concepto: `Concepto ${id}`, importe: 50, esEntrada: false,
    fecha: '2026-01-10', createdBy: 'u1', createdAt: AHORA, cuentaId: 'a', casoNombre: 'General', ...o,
  };
}

const CIERRE: CierreCaja = {
  id: 'k1', fecha: '2026-01-31', companyId: 'c-1', creadoPor: 'u1', creadoAt: AHORA,
  cuentas: [{
    cuentaId: 'a', nombre: 'Cuenta a', tipo: 'banco', ingresos: 1000, egresos: 250, sistema: 750,
    aprobado: 750, saldoReal: 750, diferencia: 0, conciliado: true,
  }],
  totales: { ingresos: 1000, egresos: 250, sistemaTotal: 750, aprobadoTotal: 750 },
};

describe('TesoreriaResumenTabComponent — móvil', () => {
  let fixture: ComponentFixture<TesoreriaResumenTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, cotejos: CotejoCuenta[] = [cotejo('a'), cotejo('b', { banco: 700, diferencia: -50, conciliado: false })]): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    await TestBed.configureTestingModule({ imports: [TesoreriaResumenTabComponent] }).compileComponents();
    fixture = TestBed.createComponent(TesoreriaResumenTabComponent);
    fixture.componentRef.setInput('cotejos', cotejos);
    fixture.componentRef.setInput('movimientosPorCuenta', new Map([['a', [mov('m1'), mov('m2', { aprobado: true })]]]));
    fixture.componentRef.setInput('resumenHistorico', null);
    fixture.componentRef.setInput('hayCuentas', cotejos.length > 0);
    fixture.componentRef.setInput('cierres', [CIERRE]);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('móvil: una tarjeta por cuenta con nombre, sistema y estado; sin tablas', async () => {
    await montar(true);
    expect(el().querySelector('table')).toBeNull();
    const cards = el().querySelectorAll('[data-cuenta-card]');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Cuenta a');
    expect(cards[0].textContent).toContain('750.00');
    expect(cards[0].textContent).toContain('Conciliado');
    expect(cards[1].textContent).toContain('Discrepancia');
  });

  it('móvil: el saldo real se edita en la tarjeta con su etiqueta accesible', async () => {
    await montar(true);
    const input = el().querySelector<HTMLInputElement>('[data-cuenta-card] input[type="number"]')!;
    expect(input.getAttribute('aria-label')).toBe('Saldo real de Cuenta a');
    const emitidos: unknown[] = [];
    fixture.componentInstance.actualizarSaldoCuenta.subscribe((e) => emitidos.push(e));
    input.value = '760';
    input.dispatchEvent(new Event('change'));
    expect(emitidos).toEqual([{ cuentaId: 'a', valor: '760' }]);
  });

  it('móvil: el botón de filtrar de la tarjeta selecciona la cuenta y expone aria-pressed', async () => {
    await montar(true);
    const btn = el().querySelector<HTMLButtonElement>('[data-cuenta-card] [data-filtrar-cuenta]')!;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    btn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.cuentaSeleccionada()).toBe('a');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('móvil: los movimientos de la cuenta son tarjetas con concepto, estado e importe', async () => {
    await montar(true);
    const movs = el().querySelectorAll('[data-movimiento-card]');
    expect(movs).toHaveLength(1); // filtro por defecto: pendientes
    expect(movs[0].textContent).toContain('Concepto m1');
    expect(movs[0].textContent).toContain('Pendiente');
    expect(movs[0].textContent).toContain('50.00');
  });

  it('móvil: el desglose de discrepancia se abre como bottom sheet', async () => {
    await montar(true);
    el().querySelector<HTMLButtonElement>('[data-discrepancia]')!.click();
    fixture.detectChanges();
    const dialog = el().querySelector('app-overlay-shell [role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.className).toContain('rounded-t-2xl');
    expect(dialog.textContent).toContain('Posibles causas');
  });

  it('móvil: el cierre de caja muestra sus totales también en móvil', async () => {
    await montar(true);
    const fila = el().querySelector('[data-cierre]')!;
    expect(fila.textContent).toContain('1,000.00');
    expect(fila.textContent).toContain('750.00');
  });

  it('escritorio: tablas y sin tarjetas', async () => {
    await montar(false);
    expect(el().querySelectorAll('table').length).toBeGreaterThan(0);
    expect(el().querySelector('[data-cuenta-card]')).toBeNull();
    expect(el().querySelector('[data-movimiento-card]')).toBeNull();
  });

  it('móvil: sin violaciones de accesibilidad', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
