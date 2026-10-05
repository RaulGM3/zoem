import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Timestamp } from '@angular/fire/firestore';
import { TesoreriaCasosTabComponent, type ResumenCaso } from './casos-tab';
import { RESUMEN_FINANCIERO_VACIO, type Caso } from '../../../../interfaces';
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

function caso(id: string): Caso {
  return {
    id, companyId: 'c-1', titulo: `Caso ${id}`, tipo: 'Legal', estado: 'en_proceso', prioridad: 'alta',
    contactoIds: [], hitos: [], resumenFinanciero: RESUMEN_FINANCIERO_VACIO, vencimiento: '2026-02-01', createdAt: AHORA, updatedAt: AHORA,
  } as Caso;
}

const RESUMEN = new Map<string, ResumenCaso>([
  ['a', { ingresos: 1200, honorarios: 300, egresos: 400, saldoAprobado: 900, saldoProyectado: 1100 }],
  ['b', { ingresos: 0, honorarios: 0, egresos: 50, saldoAprobado: -50, saldoProyectado: -50 }],
]);

describe('TesoreriaCasosTabComponent — móvil', () => {
  let fixture: ComponentFixture<TesoreriaCasosTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    await TestBed.configureTestingModule({ imports: [TesoreriaCasosTabComponent] }).compileComponents();
    fixture = TestBed.createComponent(TesoreriaCasosTabComponent);
    const r = fixture.componentRef;
    r.setInput('casosContables', [caso('a'), caso('b')]);
    r.setInput('resumenPorCaso', RESUMEN);
    r.setInput('totalIngresos', 1200);
    r.setInput('totalHonorarios', 300);
    r.setInput('totalEgresos', 450);
    r.setInput('saldoAprobado', 850);
    r.setInput('saldoProyectado', 1050);
    r.setInput('loading', false);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('móvil: una tarjeta por caso con título y saldos; sin tabla', async () => {
    await montar(true);
    expect(el().querySelector('table')).toBeNull();
    const items = el().querySelectorAll('ul > li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Caso a');
    expect(items[0].textContent).toContain('1,200.00');
    expect(items[0].textContent).toContain('900.00');
    expect(items[1].textContent).toContain('-50.00');
  });

  it('móvil: pulsar la tarjeta emite casoSeleccionado', async () => {
    await montar(true);
    const emitidos: string[] = [];
    fixture.componentInstance.casoSeleccionado.subscribe((c) => emitidos.push(c.id));
    el().querySelector<HTMLButtonElement>('[data-caso-abrir]')!.click();
    expect(emitidos).toEqual(['a']);
  });

  it('móvil: bloque de totales con los mismos importes del pie de tabla', async () => {
    await montar(true);
    const tot = el().querySelector('[data-casos-totales]')!;
    expect(tot.textContent).toContain('1,200.00');
    expect(tot.textContent).toContain('450.00');
    expect(tot.textContent).toContain('850.00');
    expect(tot.textContent).toContain('1,050.00');
  });

  it('escritorio: tabla con pie de totales y sin tarjetas', async () => {
    await montar(false);
    expect(el().querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el().querySelector('tfoot')).not.toBeNull();
    expect(el().querySelector('[data-casos-totales]')).toBeNull();
  });

  it('móvil: sin violaciones de accesibilidad', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
