import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Timestamp } from '@angular/fire/firestore';
import { CasosTableComponent } from './casos-table';
import type { Caso } from '../../../../interfaces';
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

function caso(id: string, o: Partial<Caso> = {}): Caso {
  return {
    id,
    companyId: 'c-1',
    titulo: `Caso ${id}`,
    tipo: 'Legal',
    estado: 'en_proceso',
    prioridad: 'alta',
    contactoIds: ['ct-1'],
    hitos: [],
    resumenFinanciero: {
      totalIngresos: 0, totalSuplidos: 0, totalHonorarios: 0, totalHonorariosSalida: 0,
      totalEgresos: 0, saldo: 100, ivaRepercutido: 0, ivaSoportado: 0,
    },
    vencimiento: '2026-02-01',
    createdAt: AHORA,
    updatedAt: AHORA,
    ...o,
  };
}

describe('CasosTableComponent — móvil', () => {
  let fixture: ComponentFixture<CasosTableComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, casos: Caso[], canDelete = true): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    await TestBed.configureTestingModule({ imports: [CasosTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(CasosTableComponent);
    fixture.componentRef.setInput('casos', casos);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('subtitulos', { a: 'Ana Ruiz' });
    fixture.componentRef.setInput('canDelete', canDelete);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('móvil: tarjetas con título, contacto, estado, prioridad y vencimiento; sin tabla', async () => {
    await montar(true, [caso('a'), caso('b', { prioridad: 'baja' })]);
    expect(el().querySelector('table')).toBeNull();
    const items = el().querySelectorAll('ul > li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Caso a');
    expect(items[0].textContent).toContain('Ana Ruiz');
    expect(items[0].textContent).toContain('en_proceso');
    expect(items[0].textContent).toContain('alta');
    expect(items[0].textContent).toContain('2026-02-01');
    expect(items[1].textContent).toContain('baja');
  });

  it('escritorio: tabla y sin tarjetas', async () => {
    await montar(false, [caso('a'), caso('b')]);
    expect(el().querySelector('table')).not.toBeNull();
    expect(el().querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el().querySelector('ul > li')).toBeNull();
  });

  it('móvil: pulsar la tarjeta emite casoClick', async () => {
    await montar(true, [caso('a')]);
    const emitidos: string[] = [];
    fixture.componentInstance.casoClick.subscribe((c) => emitidos.push(c.id));
    el().querySelector<HTMLElement>('[data-caso-abrir]')!.click();
    expect(emitidos).toEqual(['a']);
  });

  describe('accionesCaso', () => {
    it('con permiso: abrir y eliminar (peligrosa)', async () => {
      await montar(true, [caso('a')]);
      const a = fixture.componentInstance.accionesCaso();
      expect(a.map((x) => x.id)).toEqual(['abrir', 'eliminar']);
      expect(a[1].danger).toBe(true);
    });

    it('sin permiso de eliminar: solo abrir', async () => {
      await montar(true, [caso('a')], false);
      expect(fixture.componentInstance.accionesCaso().map((x) => x.id)).toEqual(['abrir']);
    });

    it('eliminar abre el diálogo de confirmación y confirmar emite deleteCaso', async () => {
      await montar(true, [caso('a')]);
      const c = fixture.componentInstance;
      const borrados: string[] = [];
      c.deleteCaso.subscribe((x) => borrados.push(x.id));
      c.ejecutarAccion(caso('a'), 'eliminar');
      expect(c.casoToDelete()?.id).toBe('a');
      c.confirmDelete();
      expect(borrados).toEqual(['a']);
    });

    it('abrir emite casoClick', async () => {
      await montar(true, [caso('a')]);
      const emitidos: string[] = [];
      fixture.componentInstance.casoClick.subscribe((x) => emitidos.push(x.id));
      fixture.componentInstance.ejecutarAccion(caso('a'), 'abrir');
      expect(emitidos).toEqual(['a']);
    });
  });

  it('axe: sin violaciones en móvil', async () => {
    await montar(true, [caso('a'), caso('b')]);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
