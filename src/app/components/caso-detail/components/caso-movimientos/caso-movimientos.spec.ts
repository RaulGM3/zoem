import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CasoMovimientosComponent } from './caso-movimientos';
import type { CuentaBancaria, MovimientoGestoria } from '../../../../interfaces';

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

describe('CasoMovimientosComponent', () => {
  let fixture: ComponentFixture<CasoMovimientosComponent>;
  let component: CasoMovimientosComponent;

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
    await TestBed.configureTestingModule({ imports: [CasoMovimientosComponent] }).compileComponents();
    fixture = TestBed.createComponent(CasoMovimientosComponent);
    component = fixture.componentInstance;
    set({ movimientos: MOVS, miembros: MIEMBROS, cuentas: CUENTAS });
  });

  const tarjeta = (): HTMLElement =>
    qa('h3').find(h => texto(h) === 'Movimientos')!.closest<HTMLElement>('.rounded-xl')!;
  const filas = (): HTMLElement[] => qa('tbody tr', tarjeta());
  const conceptos = (): string[] => filas().map(tr => texto(q('td p', tr)));
  const fila = (concepto: string): HTMLElement => filas().find(tr => texto(q('td p', tr)) === concepto)!;
  const celdas = (concepto: string): string[] => qa('td', fila(concepto)).map(compacto);
  const panel = (): HTMLElement => q('#mov-filtros');
  const chip = (etiqueta: string): HTMLButtonElement =>
    qa<HTMLButtonElement>('button', panel()).find(b => texto(b).startsWith(etiqueta))!;
  const buscar = (valor: string): void => {
    const input = q<HTMLInputElement>('[aria-label="Buscar en concepto y notas"]');
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('mantiene las filas durante una recarga (sin parpadeo)', () => {
    set({ loading: true });
    expect(tarjeta().textContent).not.toContain('Cargando movimientos...');
    expect(filas()).toHaveLength(MOVS.length);
  });

  it('muestra la carga y el estado vacío', () => {
    set({ loading: true, movimientos: [] });
    expect(tarjeta().textContent).toContain('Cargando movimientos...');
    set({ loading: false, movimientos: [] });
    expect(tarjeta().textContent).toContain('Sin movimientos registrados');
    expect(tarjeta().querySelector('[aria-label="Buscar en concepto y notas"]')).toBeNull();
    expect(boton('Filtros', tarjeta())).toBeUndefined();
  });

  it('lista los movimientos del más reciente al más antiguo con todos sus datos', () => {
    expect(conceptos()).toEqual(['Tasa 696', 'Mensajería', 'Provisión de fondos', 'Minuta']);
    expect(celdas('Provisión de fondos').slice(0, 6)).toEqual([
      'Provisión de fondos', 'ingreso', '2026-03-01', '+1,000.00 € base 826.45 · IVA 173.55 (21%)', 'Operativa', 'Ana',
    ].map(compacto));
    expect(celdas('Tasa 696').slice(0, 6)).toEqual([
      'Tasa 696 Juzgado nº 3', 'suplido', '2026-03-05', '−150.00 € exento', '—', 'Luis editado · Ana',
    ].map(compacto));
    expect(celdas('Minuta')[3]).toBe(compacto('−300.00 € base 247.93 · IVA 52.07'));
    expect(celdas('Mensajería').slice(3, 6)).toEqual(['−50.00 €', 'Operativa', '—'].map(compacto));
  });

  it('ordena al pulsar las cabeceras y lo refleja en aria-sort', () => {
    const cabecera = (col: string): HTMLElement => q(`[aria-label="Ordenar por ${col}"]`).closest('th')!;
    expect(cabecera('Fecha').getAttribute('aria-sort')).toBe('descending');
    click(q('[aria-label="Ordenar por Fecha"]'));
    expect(cabecera('Fecha').getAttribute('aria-sort')).toBe('ascending');
    expect(conceptos()[0]).toBe('Minuta');
    click(q('[aria-label="Ordenar por Importe"]'));
    expect(cabecera('Importe').getAttribute('aria-sort')).toBe('descending');
    expect(cabecera('Fecha').getAttribute('aria-sort')).toBe('none');
    expect(conceptos()).toEqual(['Provisión de fondos', 'Minuta', 'Tasa 696', 'Mensajería']);
    click(q('[aria-label="Ordenar por Concepto"]'));
    expect(cabecera('Concepto').getAttribute('aria-sort')).toBe('ascending');
    expect(conceptos()).toEqual(['Mensajería', 'Minuta', 'Provisión de fondos', 'Tasa 696']);
  });

  it('busca en concepto y notas y muestra cuántos coinciden', () => {
    expect(tarjeta().textContent).not.toContain(' de 4');
    buscar('juzgado');
    expect(conceptos()).toEqual(['Tasa 696']);
    expect(texto(q('.tabular-nums', tarjeta()))).toBe('1 de 4');
  });

  it('el panel de filtros se despliega con su botón', () => {
    expect(panel().hidden).toBe(true);
    click(boton('Filtros', tarjeta()));
    expect(panel().hidden).toBe(false);
    expect(boton('Filtros', tarjeta())!.getAttribute('aria-expanded')).toBe('true');
  });

  it('filtra por tipo con el contador de cada chip', () => {
    expect(qa('button', panel()).map(texto).slice(0, 4)).toEqual(['Ingreso 1', 'Suplido 1', 'Honorario 1', 'Gasto 1']);
    click(chip('Suplido'));
    click(chip('Gasto'));
    expect(conceptos()).toEqual(['Tasa 696', 'Mensajería']);
    expect(chip('Suplido').getAttribute('aria-pressed')).toBe('true');
    click(chip('Suplido'));
    expect(conceptos()).toEqual(['Mensajería']);
  });

  it('no ofrece chips de tipo si solo hay uno', () => {
    set({ movimientos: [MOVS[1]] });
    expect(panel().textContent).not.toContain('Tipo');
  });

  it('filtra por dirección', () => {
    click(chip('Entradas'));
    expect(conceptos()).toEqual(['Provisión de fondos']);
    click(chip('Salidas'));
    expect(conceptos()).toHaveLength(3);
    click(chip('Todas'));
    expect(conceptos()).toHaveLength(4);
  });

  it('filtra por cuenta, incluido "Sin cuenta"', () => {
    click(chip('Clientes'));
    expect(conceptos()).toEqual(['Minuta']);
    click(chip('Sin cuenta'));
    expect(conceptos()).toEqual(['Tasa 696', 'Minuta']);
    click(chip('Clientes'));
    expect(conceptos()).toEqual(['Tasa 696']);
  });

  it('no ofrece "Sin cuenta" si todos los movimientos tienen cuenta, ni cuentas si no hay ninguna', () => {
    set({ movimientos: [MOVS[0], MOVS[2]] });
    expect(qa('button', panel()).some(b => texto(b) === 'Sin cuenta')).toBe(false);
    set({ cuentas: [] });
    expect(panel().textContent).not.toContain('Cuenta');
  });

  it('filtra por rango de fechas y ofrece atajos', () => {
    const desde = q<HTMLInputElement>('#filtro-desde');
    const hasta = q<HTMLInputElement>('#filtro-hasta');
    desde.value = '2026-03-02';
    desde.dispatchEvent(new Event('input'));
    hasta.value = '2026-03-04';
    hasta.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(conceptos()).toEqual(['Mensajería']);

    const anio = new Date().getFullYear();
    click(chip('Este año'));
    expect([desde.value, hasta.value]).toEqual([`${anio}-01-01`, `${anio}-12-31`]);
    click(chip('Este mes'));
    expect(desde.value).toMatch(new RegExp(`^${anio}-\\d{2}-01$`));
    click(chip('Trimestre'));
    expect(desde.value).toMatch(new RegExp(`^${anio}-(01|04|07|10)-01$`));
    expect(hasta.value).toMatch(new RegExp(`^${anio}-(03-31|06-30|09-30|12-31)$`));
  });

  it('limpia todos los filtros, también desde la tabla sin resultados', () => {
    expect(boton('Limpiar filtros', panel())).toBeUndefined();
    buscar('no existe');
    click(chip('Entradas'));
    expect(tarjeta().textContent).toContain('Ningún movimiento coincide con los filtros');
    click(boton('Limpiar filtros', q('tbody', tarjeta())));
    expect(conceptos()).toHaveLength(4);
    expect(q<HTMLInputElement>('[aria-label="Buscar en concepto y notas"]').value).toBe('');
    expect(chip('Todas').getAttribute('aria-pressed')).toBe('true');

    click(chip('Entradas'));
    click(boton('Limpiar filtros', panel()));
    expect(conceptos()).toHaveLength(4);
  });

  it('añade, edita y elimina movimientos avisando al contenedor', () => {
    const eventos: unknown[] = [];
    component.addMov.subscribe(() => eventos.push('add'));
    component.editMov.subscribe(m => eventos.push(['edit', m.id]));
    component.deleteMov.subscribe(id => eventos.push(['delete', id]));
    click(boton('Añadir', tarjeta()));
    click(q('[aria-label="Editar el movimiento Minuta"]'));
    click(q('[aria-label="Eliminar movimiento"]', fila('Minuta')));
    expect(texto(fila('Minuta'))).toContain('¿Seguro?');
    click(q('[aria-label="Cancelar"]', fila('Minuta')));
    click(q('[aria-label="Eliminar movimiento"]', fila('Minuta')));
    click(q('[aria-label="Confirmar eliminación del movimiento"]', fila('Minuta')));
    expect(eventos).toEqual(['add', ['edit', 'm3'], ['delete', 'm3']]);
    expect(fila('Minuta').querySelector('[aria-label="Confirmar eliminación del movimiento"]')).toBeNull();
  });

  it('respeta los permisos de edición y borrado', () => {
    set({ canEdit: false, canDelete: false });
    expect(boton('Añadir', tarjeta())).toBeUndefined();
    expect(tarjeta().querySelector('[aria-label^="Editar el movimiento"]')).toBeNull();
    expect(tarjeta().querySelector('[aria-label="Eliminar movimiento"]')).toBeNull();
  });

  it('filtrarPorTipo deja solo las salidas de ese tipo y despliega los filtros', () => {
    component.filtrarPorTipo('honorario');
    fixture.detectChanges();
    expect(conceptos()).toEqual(['Minuta']);
    expect(panel().hidden).toBe(false);
    expect(chip('Salidas').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Honorario').getAttribute('aria-pressed')).toBe('true');
  });
});
