import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CasoGestoriaTabComponent } from './caso-gestoria-tab';
import type {
  CuentaBancaria, GestoriaSlot, MovimientoGestoria, ResumenFinanciero,
} from '../../../../interfaces';

const SLOTS = [
  { id: 's1', nombre: 'Tasa judicial', tipoCosto: 'suplido', importeEstimado: 50, status: 'pendiente' },
  { id: 's2', nombre: 'Procurador', tipoCosto: 'gastos', status: 'pendiente' },
  { id: 's3', nombre: 'Notaría', tipoCosto: 'suplido', importeEstimado: 100, importeReal: 120.5, status: 'registrado' },
] as unknown as GestoriaSlot[];

const MOVS = [
  { id: 'm1', concepto: 'Provisión de fondos', tipo: 'ingreso', fecha: '2026-03-01', importe: 1000, esEntrada: true, cuentaId: 'cu1', createdBy: 'u1', baseImponible: 826.45, cuotaIva: 173.55, tipoIva: 21 },
  { id: 'm2', concepto: 'Tasa 696', notas: 'Juzgado nº 3', tipo: 'suplido', fecha: '2026-03-05', importe: 150, esEntrada: false, createdBy: 'u2', updatedBy: 'u1', ivaExento: true },
  { id: 'm3', concepto: 'Minuta', tipo: 'honorario', fecha: '2026-02-10', importe: 300, esEntrada: false, cuentaId: 'cu2', createdBy: 'u1', baseImponible: 247.93, cuotaIva: 52.07 },
  { id: 'm4', concepto: 'Mensajería', tipo: 'gasto', fecha: '2026-03-03', importe: 50, esEntrada: false, cuentaId: 'cu1', createdBy: 'desconocido' },
] as unknown as MovimientoGestoria[];

const CUENTAS = [
  { id: 'cu1', nombre: 'Operativa' },
  { id: 'cu2', nombre: 'Clientes' },
] as CuentaBancaria[];

const MIEMBROS = new Map([['u1', 'Ana'], ['u2', 'Luis']]);

describe('CasoGestoriaTabComponent', () => {
  let fixture: ComponentFixture<CasoGestoriaTabComponent>;
  let component: CasoGestoriaTabComponent;

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
  const boton = (etiqueta: string, raiz: HTMLElement = el()): HTMLButtonElement | undefined =>
    qa<HTMLButtonElement>('button', raiz).find(b => texto(b) === etiqueta);

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
    await TestBed.configureTestingModule({ imports: [CasoGestoriaTabComponent] }).compileComponents();
    fixture = TestBed.createComponent(CasoGestoriaTabComponent);
    component = fixture.componentInstance;
    set({
      slots: SLOTS, movimientos: MOVS, movimientosLoading: false, resumen: {} as ResumenFinanciero,
      miembros: MIEMBROS, cuentas: CUENTAS,
    });
  });

  // El comportamiento de cada bloque vive en el spec de su componente; aquí se
  // comprueba la composición: qué se monta y que cada evento llega al contenedor.

  it('monta los costos previstos solo si el caso los tiene', () => {
    expect(el().querySelector('app-caso-costos-previstos')).not.toBeNull();
    set({ slots: [] });
    expect(el().querySelector('app-caso-costos-previstos')).toBeNull();
  });

  it('reenvía el registro, la eliminación y el reordenado de costos previstos', () => {
    const eventos: unknown[] = [];
    component.registerSlot.subscribe(s => eventos.push(['register', s.id]));
    component.unregisterSlot.subscribe(s => eventos.push(['unregister', s.id]));
    component.reorderSlots.subscribe(l => eventos.push(['reorder', l.map(x => x.id)]));
    const costos = q('app-caso-costos-previstos');
    click(boton('Registrar', costos));
    click(boton('Ver 1 registrado', costos));
    click(q('[aria-label="Eliminar movimiento registrado"]', costos));
    click(q('[aria-label="Confirmar eliminación del movimiento"]', costos));
    const filas = qa('[draggable="true"]', costos);
    filas[0].dispatchEvent(new Event('dragstart'));
    filas[1].dispatchEvent(new Event('dragover', { cancelable: true }));
    filas[1].dispatchEvent(new Event('drop', { cancelable: true }));
    expect(eventos).toEqual([['register', 's1'], ['unregister', 's3'], ['reorder', ['s2', 's1', 's3']]]);
  });

  it('el resumen y la tabla se calculan sobre los mismos movimientos', () => {
    expect(compacto(q('app-caso-resumen-financiero'))).toContain('Ingresos1,000.00€');
    expect(qa('app-caso-movimientos tbody tr')).toHaveLength(4);
  });

  it('pulsar un tipo en el desglose de egresos filtra la tabla por ese tipo de salida', () => {
    click(q('#egresos-desglose-trigger'));
    click(q('[aria-label="Filtrar movimientos por Honorarios"]'));
    expect(q('#egresos-desglose').hidden).toBe(true);
    expect(q('#mov-filtros').hidden).toBe(false);
    expect(qa('tbody tr').map(tr => texto(q('td p', tr)))).toEqual(['Minuta']);
    expect(boton('Salidas')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('pasa a la tabla la carga, los miembros, las cuentas y los permisos', () => {
    const tabla = q('app-caso-movimientos');
    expect(compacto(tabla)).toContain('Operativa');
    expect(compacto(tabla)).toContain('editado·Ana');
    set({ canEdit: false, canDelete: false });
    expect(boton('Añadir', tabla)).toBeUndefined();
    expect(tabla.querySelector('[aria-label="Eliminar movimiento"]')).toBeNull();
    set({ movimientosLoading: true });
    expect(tabla.textContent).toContain('Cargando movimientos...');
  });

  it('reenvía el alta, la edición y el borrado de movimientos', () => {
    const eventos: unknown[] = [];
    component.addMov.subscribe(() => eventos.push('add'));
    component.editMov.subscribe(m => eventos.push(['edit', m.id]));
    component.deleteMov.subscribe(id => eventos.push(['delete', id]));
    const fila = qa('tbody tr').find(tr => texto(q('td p', tr)) === 'Minuta')!;
    click(boton('Añadir'));
    click(q('[aria-label="Editar el movimiento Minuta"]'));
    click(q('[aria-label="Eliminar movimiento"]', fila));
    click(q('[aria-label="Confirmar eliminación del movimiento"]', fila));
    expect(eventos).toEqual(['add', ['edit', 'm3'], ['delete', 'm3']]);
  });
});
