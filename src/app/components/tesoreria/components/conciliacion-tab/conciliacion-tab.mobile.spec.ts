import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Timestamp } from '@angular/fire/firestore';
import { ConciliacionTabComponent, type MovimientoConciliable } from './conciliacion-tab';
import type { CuentaBancaria, LineaExtracto } from '../../../../interfaces';
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

const CUENTA: CuentaBancaria = { id: 'a', companyId: 'c-1', nombre: 'Cuenta a', tipo: 'banco', activa: true, createdAt: AHORA };

function linea(id: string, o: Partial<LineaExtracto> = {}): LineaExtracto {
  return {
    id, cuentaId: 'a', companyId: 'c-1', fecha: '2026-01-10', concepto: `Linea ${id}`, importe: -40,
    estado: 'pendiente', importadoPor: 'u1', importadoAt: AHORA, ...o,
  };
}

const MOVS: MovimientoConciliable[] = [
  { id: 'm1', cuentaId: 'a', fecha: '2026-01-09', concepto: 'Luz', importe: 40, esEntrada: false, casoNombre: 'General', conciliado: false },
];

describe('ConciliacionTabComponent — móvil', () => {
  let fixture: ComponentFixture<ConciliacionTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    await TestBed.configureTestingModule({ imports: [ConciliacionTabComponent] }).compileComponents();
    fixture = TestBed.createComponent(ConciliacionTabComponent);
    fixture.componentRef.setInput('cuentas', [CUENTA]);
    fixture.componentRef.setInput('lineas', [linea('l1'), linea('l2', { estado: 'casado', movimientoId: 'mX', fecha: '2026-01-05', importe: 100 })]);
    fixture.componentRef.setInput('movimientos', MOVS);
    fixture.componentInstance.cuentaSeleccionada.set('a');
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('móvil: una tarjeta por línea con concepto, importe y estado; sin tabla', async () => {
    await montar(true);
    expect(el().querySelector('table')).toBeNull();
    const cards = el().querySelectorAll('[data-linea-card]');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Linea l1');
    expect(cards[0].textContent).toContain('-40.00');
    expect(cards[0].textContent).toContain('Pendiente');
    expect(cards[1].textContent).toContain('Casado');
  });

  it('móvil: la línea pendiente permite casar con un select etiquetado e ignorar', async () => {
    await montar(true);
    const card = el().querySelectorAll('[data-linea-card]')[0];
    const select = card.querySelector<HTMLSelectElement>('select')!;
    expect(select.getAttribute('aria-label')).toBe('Casar línea Linea l1 con un movimiento');
    const emitidos: unknown[] = [];
    fixture.componentInstance.casar.subscribe((e) => emitidos.push(e));
    select.value = 'm1';
    select.dispatchEvent(new Event('change'));
    expect(emitidos).toEqual([{ cuentaId: 'a', lineaId: 'l1', movimientoId: 'm1' }]);

    const ignorados: unknown[] = [];
    fixture.componentInstance.ignorar.subscribe((e) => ignorados.push(e));
    const ignorar = card.querySelector<HTMLButtonElement>('[data-ignorar]')!;
    expect(ignorar.className).toContain('tap-target');
    ignorar.click();
    expect(ignorados).toEqual([{ cuentaId: 'a', lineaId: 'l1' }]);
  });

  it('móvil: la línea casada permite deshacer', async () => {
    await montar(true);
    const emitidos: unknown[] = [];
    fixture.componentInstance.desconciliar.subscribe((e) => emitidos.push(e));
    el().querySelectorAll('[data-linea-card]')[1].querySelector<HTMLButtonElement>('[data-deshacer]')!.click();
    expect(emitidos).toEqual([{ cuentaId: 'a', lineaId: 'l2' }]);
  });

  it('móvil: la barra de cuenta/importación se apila a ancho completo', async () => {
    await montar(true);
    const barra = el().querySelector('[data-conciliacion-barra]')!;
    expect(barra.className).toContain('flex-col');
    expect(barra.className).toContain('sm:flex-row');
  });

  it('escritorio: tabla y sin tarjetas', async () => {
    await montar(false);
    expect(el().querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el().querySelector('[data-linea-card]')).toBeNull();
  });

  it('móvil: sin violaciones de accesibilidad', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
