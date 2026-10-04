import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HitoFormDrawerComponent, type HitoFormData } from './hito-form-drawer/hito-form-drawer';
import { MovimientoFormDrawerComponent, type MovimientoFormData } from './movimiento-form-drawer/movimiento-form-drawer';
import type { CompanyMember, CuentaBancaria } from '../../../interfaces';
import { mockViewport } from '../mock-viewport';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';

const MEMBERS = [
  { id: 'a', userId: 'u1', nombre: 'Ana', apellido: 'Ruiz' },
  { id: 'b', userId: 'u2', nombre: 'Luis' },
] as unknown as CompanyMember[];
const CUENTAS = [{ id: 'cu1', nombre: 'Operativa' }] as CuentaBancaria[];

function escribir(el: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
  el.value = valor;
  el.dispatchEvent(new Event('input'));
}

describe('HitoFormDrawerComponent — overlay-shell', () => {
  let fixture: ComponentFixture<HitoFormDrawerComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, visible = true): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [HitoFormDrawerComponent] });
    fixture = TestBed.createComponent(HitoFormDrawerComponent);
    fixture.componentRef.setInput('visible', visible);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('editingHito', null);
    fixture.componentRef.setInput('members', MEMBERS);
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('no pinta nada si no está visible', async () => {
    await montar(true, false);
    expect(el().querySelector('[role="dialog"]')).toBeNull();
  });

  it('es un diálogo a pantalla completa en móvil con título accesible', async () => {
    await montar(true);
    const dialog = el().querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.classList.contains('h-dvh')).toBe(true);
    expect(el().querySelector('h2')!.textContent).toContain('Nuevo hito');
    expect(dialog.getAttribute('aria-labelledby')).toBe(el().querySelector('h2')!.id);
  });

  it('el título cambia al editar', async () => {
    await montar(false);
    fixture.componentRef.setInput('editingHito', { id: 'h1', titulo: 'X', estado: 'pendiente' });
    await fixture.whenStable();
    expect(el().querySelector('h2')!.textContent).toContain('Editar hito');
  });

  it('la rejilla estado/fecha es de una columna en móvil y dos desde sm', async () => {
    await montar(true);
    const grid = el().querySelector('.grid')!;
    expect(grid.classList.contains('grid-cols-1')).toBe(true);
    expect(grid.classList.contains('sm:grid-cols-2')).toBe(true);
  });

  it('el botón de guardar está en el footer y emite saved con los datos', async () => {
    await montar(true);
    const out: HitoFormData[] = [];
    fixture.componentInstance.saved.subscribe((d) => out.push(d));
    const footer = el().querySelector<HTMLElement>('[data-overlay-footer]')!;
    const guardar = Array.from(footer.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Añadir')!;
    expect(guardar.disabled).toBe(true);
    escribir(el().querySelector<HTMLInputElement>('#hito-titulo')!, '  Presentar demanda ');
    el().querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    fixture.detectChanges();
    expect(guardar.disabled).toBe(false);
    guardar.click();
    expect(out).toEqual([{
      titulo: 'Presentar demanda', descripcion: undefined, fechaEstimada: undefined,
      asignadoA: 'u1', asignadosA: ['u1'], estado: 'pendiente',
    }]);
  });

  it('cancelar, la X, el fondo y Escape emiten closed', async () => {
    await montar(true);
    let cierres = 0;
    fixture.componentInstance.closed.subscribe(() => cierres++);
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Cancelar')!.click();
    el().querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click();
    el().querySelector<HTMLElement>('[data-overlay-backdrop]')!.click();
    expect(cierres).toBe(3);
    el().querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cierres).toBe(4);
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});

describe('MovimientoFormDrawerComponent — overlay-shell', () => {
  let fixture: ComponentFixture<MovimientoFormDrawerComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, visible = true): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [MovimientoFormDrawerComponent] });
    fixture = TestBed.createComponent(MovimientoFormDrawerComponent);
    fixture.componentRef.setInput('visible', visible);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('prefillSlot', null);
    fixture.componentRef.setInput('cuentas', CUENTAS);
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('no pinta nada si no está visible', async () => {
    await montar(true, false);
    expect(el().querySelector('[role="dialog"]')).toBeNull();
  });

  it('es un diálogo a pantalla completa en móvil', async () => {
    await montar(true);
    expect(el().querySelector('[role="dialog"]')!.classList.contains('h-dvh')).toBe(true);
    expect(el().querySelector('h2')!.textContent).toContain('Nuevo movimiento');
  });

  it('las dos rejillas son de una columna en móvil y dos desde sm', async () => {
    await montar(true);
    const grids = Array.from(el().querySelectorAll('.grid'));
    expect(grids).toHaveLength(2);
    for (const g of grids) {
      expect(g.classList.contains('grid-cols-1')).toBe(true);
      expect(g.classList.contains('sm:grid-cols-2')).toBe(true);
    }
  });

  it('guardar vive en el footer y emite saved con el desglose', async () => {
    await montar(true);
    const out: MovimientoFormData[] = [];
    fixture.componentInstance.saved.subscribe((d) => out.push(d));
    const footer = el().querySelector<HTMLElement>('[data-overlay-footer]')!;
    const guardar = Array.from(footer.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Guardar')!;
    expect(guardar.disabled).toBe(true);
    escribir(el().querySelector<HTMLInputElement>('#mov-concepto')!, 'Provisión');
    escribir(el().querySelector<HTMLInputElement>('#mov-importe')!, '100');
    const cuenta = el().querySelector<HTMLSelectElement>('#mov-cuenta')!;
    cuenta.value = 'cu1';
    cuenta.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(guardar.disabled).toBe(false);
    guardar.click();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ concepto: 'Provisión', tipo: 'ingreso', esEntrada: true, cuentaId: 'cu1', tipoIva: 21, ivaExento: false });
    expect(out[0].importe).toBeCloseTo(121, 2);
  });

  it('cancelar y Escape emiten closed', async () => {
    await montar(false);
    let cierres = 0;
    fixture.componentInstance.closed.subscribe(() => cierres++);
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Cancelar')!.click();
    el().querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cierres).toBe(2);
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
