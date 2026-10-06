import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Timestamp } from '@angular/fire/firestore';
import { CuentasDrawerComponent } from './cuentas-drawer/cuentas-drawer';
import { CierreCajaModalComponent } from './cierre-caja-modal/cierre-caja-modal';
import { MovimientoGeneralDrawerComponent } from './movimiento-general-drawer/movimiento-general-drawer';
import { TesoresriaCasoDrawerComponent } from './tesoreria-caso-drawer/tesoreria-caso-drawer';
import { GestoriaService } from '../../../core/services/gestoria.service';
import { CuentasService } from '../../../core/services/cuentas.service';
import { CasosService } from '../../../core/services/casos.service';
import { ToastService } from '../../../core/services/toast.service';
import { RESUMEN_FINANCIERO_VACIO, type Caso, type CierreCuenta } from '../../../interfaces';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';

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

const CIERRE: CierreCuenta[] = [{
  cuentaId: 'a', nombre: 'Cuenta a', tipo: 'banco', ingresos: 100, egresos: 40, sistema: 60,
  aprobado: 60, saldoReal: 60, diferencia: 0, conciliado: true,
}];

const CASO = {
  id: 'k', companyId: 'c-1', titulo: 'Caso K', tipo: 'Legal', estado: 'en_proceso', prioridad: 'alta',
  contactoIds: [], hitos: [], resumenFinanciero: RESUMEN_FINANCIERO_VACIO, vencimiento: '2026-02-01', createdAt: AHORA, updatedAt: AHORA,
} as Caso;

async function montar<T>(cmp: Type<T>, mobile: boolean, inputs: Record<string, unknown> = {}): Promise<ComponentFixture<T>> {
  TestBed.resetTestingModule();
  mockViewport(mobile);
  await TestBed.configureTestingModule({
    imports: [cmp],
    providers: [
      {
        provide: GestoriaService,
        useValue: {
          slots: signal([]), movimientos: signal([]), loading: signal(false),
          loadSlots: vi.fn(), loadMovimientos: vi.fn(), stopMovimientos: vi.fn(),
        },
      },
      { provide: CuentasService, useValue: { cuentas: signal([]), loading: signal(false) } },
      { provide: CasosService, useValue: { casos: signal([]) } },
      { provide: ToastService, useValue: { run: vi.fn() } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(cmp);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

const dialogo = (f: ComponentFixture<unknown>): HTMLElement =>
  (f.nativeElement as HTMLElement).querySelector('app-overlay-shell [role="dialog"]')!;
const pie = (f: ComponentFixture<unknown>): HTMLElement =>
  (f.nativeElement as HTMLElement).querySelector('[data-overlay-footer]')!;

describe('Drawers de Tesorería — móvil', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('CuentasDrawerComponent', () => {
    it('usa overlay-shell a pantalla completa en móvil', async () => {
      const f = await montar(CuentasDrawerComponent, true);
      expect(dialogo(f).className).toContain('h-dvh');
      expect(dialogo(f).textContent).toContain('Cuentas bancarias');
    });

    it('el formulario tiene etiquetas asociadas y botones táctiles', async () => {
      const f = await montar(CuentasDrawerComponent, true);
      const el = f.nativeElement as HTMLElement;
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Nueva cuenta'))!.click();
      f.detectChanges();
      expect(el.querySelector('label[for="cuenta-nombre"]')).not.toBeNull();
      expect(el.querySelector('input#cuenta-nombre')).not.toBeNull();
      const v = await analizarA11y(el);
      expect(v, formatearViolaciones(v)).toEqual([]);
    });

    it('escritorio: panel lateral', async () => {
      const f = await montar(CuentasDrawerComponent, false);
      expect(dialogo(f).className).toContain('max-w-md');
    });
  });

  describe('CierreCajaModalComponent', () => {
    it('móvil: bottom sheet con las acciones en el pie sticky', async () => {
      const f = await montar(CierreCajaModalComponent, true, { cuentas: CIERRE });
      expect(dialogo(f).className).toContain('rounded-t-2xl');
      expect(pie(f).textContent).toContain('Cancelar');
      expect(pie(f).textContent).toContain('Confirmar cierre');
    });

    it('móvil: totales en rejilla de 3 columnas que no desborda', async () => {
      const f = await montar(CierreCajaModalComponent, true, { cuentas: CIERRE });
      const tot = (f.nativeElement as HTMLElement).querySelector('[data-cierre-totales]')!;
      expect(tot.className).toContain('grid-cols-3');
    });

    it('móvil: sin violaciones de accesibilidad', async () => {
      const f = await montar(CierreCajaModalComponent, true, { cuentas: CIERRE });
      const v = await analizarA11y(f.nativeElement);
      expect(v, formatearViolaciones(v)).toEqual([]);
    });
  });

  describe('MovimientoGeneralDrawerComponent', () => {
    it('móvil: pantalla completa con Cancelar y Registrar en el pie sticky', async () => {
      const f = await montar(MovimientoGeneralDrawerComponent, true, { visible: true });
      expect(dialogo(f).className).toContain('h-dvh');
      expect(pie(f).textContent).toContain('Cancelar');
      expect(pie(f).textContent).toContain('Registrar');
    });

    it('oculto cuando visible=false', async () => {
      const f = await montar(MovimientoGeneralDrawerComponent, true, { visible: false });
      expect(dialogo(f)).toBeNull();
    });

    it('la dirección expone aria-pressed y sin violaciones de accesibilidad', async () => {
      const f = await montar(MovimientoGeneralDrawerComponent, true, { visible: true });
      const el = f.nativeElement as HTMLElement;
      const dir = el.querySelectorAll('[data-direccion]');
      expect(dir).toHaveLength(2);
      expect(dir[1].getAttribute('aria-pressed')).toBe('true'); // gasto → salida
      const v = await analizarA11y(el);
      expect(v, formatearViolaciones(v)).toEqual([]);
    });
  });

  describe('TesoresriaCasoDrawerComponent', () => {
    it('móvil: overlay-shell a pantalla completa con el título del caso', async () => {
      const f = await montar(TesoresriaCasoDrawerComponent, true, { caso: CASO });
      expect(dialogo(f).className).toContain('h-dvh');
      expect(dialogo(f).querySelector('h2')!.textContent).toContain('Caso K');
    });

    it('sin caso no renderiza el diálogo', async () => {
      const f = await montar(TesoresriaCasoDrawerComponent, true, { caso: null });
      expect(dialogo(f)).toBeNull();
    });
  });
});
