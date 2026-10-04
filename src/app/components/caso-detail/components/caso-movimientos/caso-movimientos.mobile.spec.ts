import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CasoMovimientosComponent } from './caso-movimientos';
import type { CuentaBancaria, MovimientoGestoria } from '../../../../interfaces';
import { mockViewport } from '../../mock-viewport';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const MOVS = [
  { id: 'm1', concepto: 'Provisión de fondos', tipo: 'ingreso', fecha: '2026-03-01', importe: 1000, esEntrada: true, cuentaId: 'cu1', createdBy: 'u1', baseImponible: 826.45, cuotaIva: 173.55, tipoIva: 21 },
  { id: 'm2', concepto: 'Tasa 696', notas: 'Juzgado nº 3', tipo: 'suplido', fecha: '2026-03-05', importe: 150, esEntrada: false, createdBy: 'u2', updatedBy: 'u1', ivaExento: true },
  { id: 'm3', concepto: 'Minuta', tipo: 'honorario', fecha: '2026-02-10', importe: 300, esEntrada: false, cuentaId: 'cu2', createdBy: 'u1' },
] as unknown as MovimientoGestoria[];

const CUENTAS = [{ id: 'cu1', nombre: 'Operativa' }, { id: 'cu2', nombre: 'Clientes' }] as CuentaBancaria[];
const MIEMBROS = new Map([['u1', 'Ana'], ['u2', 'Luis']]);

describe('CasoMovimientosComponent — móvil', () => {
  let fixture: ComponentFixture<CasoMovimientosComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const cards = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('ul > li'));

  async function montar(mobile: boolean, inputs: Record<string, unknown> = {}): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [CasoMovimientosComponent] });
    fixture = TestBed.createComponent(CasoMovimientosComponent);
    fixture.componentRef.setInput('movimientos', MOVS);
    fixture.componentRef.setInput('miembros', MIEMBROS);
    fixture.componentRef.setInput('cuentas', CUENTAS);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    await fixture.whenStable();
  }

  async function elegir(card: HTMLElement, id: string): Promise<void> {
    card.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    el().querySelector<HTMLButtonElement>(`[data-action-id="${id}"]`)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('móvil: tarjetas sin tabla con concepto, tipo, fecha, importe y cuenta', async () => {
    await montar(true);
    expect(el().querySelector('table')).toBeNull();
    expect(cards()).toHaveLength(3);
    // orden por defecto: fecha descendente -> m2, m1, m3
    const t = cards()[1].textContent!.replace(/\s+/g, ' ');
    expect(t).toContain('Provisión de fondos');
    expect(t).toContain('ingreso');
    expect(t).toContain('2026-03-01');
    expect(t).toContain('+1,000.00 €');
    expect(t).toContain('Operativa');
    expect(t).toContain('Ana');
    expect(cards()[0].textContent).toContain('Juzgado nº 3');
    expect(cards()[0].textContent).toContain('exento');
    expect(cards()[0].textContent).toContain('editado');
  });

  it('escritorio: tabla', async () => {
    await montar(false);
    expect(el().querySelector('table')).not.toBeNull();
    expect(el().querySelector('ul > li')).toBeNull();
  });

  it('móvil: selector "Ordenar por" cambia el orden', async () => {
    await montar(true);
    const select = el().querySelector<HTMLSelectElement>('select#mov-orden')!;
    expect(el().querySelector('label[for="mov-orden"]')!.textContent).toContain('Ordenar por');
    select.value = 'importe:asc';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(cards().map((c) => c.textContent!.includes('Tasa 696'))).toEqual([true, false, false]);
  });

  it('el valor del orden se calcula a partir del orden actual y se ignoran valores inválidos', async () => {
    await montar(true);
    const c = fixture.componentInstance;
    expect(c.valorOrden()).toBe('fecha:desc');
    c.establecerOrden('concepto:asc');
    expect(c.orden()).toEqual({ campo: 'concepto', direccion: 'asc' });
    c.establecerOrden('nada');
    c.establecerOrden('fecha:sideways');
    expect(c.orden()).toEqual({ campo: 'concepto', direccion: 'asc' });
  });

  it('acciones por movimiento según permisos', async () => {
    await montar(true);
    const c = fixture.componentInstance;
    expect(c.acciones().map((a) => a.id)).toEqual(['edit', 'delete']);
    fixture.componentRef.setInput('canDelete', false);
    expect(c.acciones().map((a) => a.id)).toEqual(['edit']);
    fixture.componentRef.setInput('canEdit', false);
    expect(c.acciones()).toEqual([]);
  });

  it('móvil: sin permisos no hay menú', async () => {
    await montar(true, { canEdit: false, canDelete: false });
    expect(el().querySelector('button[aria-haspopup="menu"]')).toBeNull();
  });

  it('móvil: editar y eliminar emiten lo mismo que escritorio', async () => {
    await montar(true);
    const editados: string[] = [];
    const borrados: string[] = [];
    fixture.componentInstance.editMov.subscribe((m) => editados.push(m.id));
    fixture.componentInstance.deleteMov.subscribe((id) => borrados.push(id));
    await elegir(cards()[1], 'edit');
    expect(editados).toEqual(['m1']);
    await elegir(cards()[0], 'delete');
    expect(cards()[0].textContent).toContain('¿Seguro?');
    expect(el().querySelector('button[aria-haspopup="menu"]')).not.toBeNull();
    cards()[0].querySelector<HTMLButtonElement>('button[aria-label="Confirmar eliminación del movimiento"]')!.click();
    fixture.detectChanges();
    expect(borrados).toEqual(['m2']);
  });

  it('móvil: cancelar la confirmación restaura el menú', async () => {
    await montar(true);
    await elegir(cards()[0], 'delete');
    cards()[0].querySelector<HTMLButtonElement>('button[aria-label="Cancelar"]')!.click();
    fixture.detectChanges();
    expect(cards()[0].querySelector('button[aria-haspopup="menu"]')).not.toBeNull();
  });

  it('con filtros sin coincidencias muestra el vacío con "Limpiar filtros" en ambos viewports', async () => {
    for (const mobile of [true, false]) {
      await montar(mobile);
      const c = fixture.componentInstance;
      c.filtroTexto.set('zzz');
      fixture.detectChanges();
      expect(el().textContent).toContain('Ningún movimiento coincide con los filtros');
      const limpiar = Array.from(el().querySelectorAll('button')).filter((b) => b.textContent!.trim() === 'Limpiar filtros');
      expect(limpiar.length).toBeGreaterThan(0);
    }
  });

  it('la barra de búsqueda ocupa todo el ancho en móvil', async () => {
    await montar(true);
    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(input.classList.contains('w-full')).toBe(true);
    expect(input.classList.contains('sm:w-56')).toBe(true);
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
