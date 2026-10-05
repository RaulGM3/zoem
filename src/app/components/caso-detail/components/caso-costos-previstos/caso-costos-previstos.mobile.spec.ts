import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CasoCostosPrevistosComponent } from './caso-costos-previstos';
import type { GestoriaSlot } from '../../../../interfaces';
import { mockViewport } from '../../mock-viewport';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const SLOTS = [
  { id: 's1', nombre: 'Tasa judicial', tipoCosto: 'suplido', importeEstimado: 50, status: 'pendiente' },
  { id: 's3', nombre: 'Notaría', tipoCosto: 'suplido', importeEstimado: 100, importeReal: 120.5, status: 'registrado' },
] as unknown as GestoriaSlot[];

describe('CasoCostosPrevistosComponent — móvil', () => {
  let fixture: ComponentFixture<CasoCostosPrevistosComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const filas = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('[draggable="true"]'));

  async function montar(mobile: boolean): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [CasoCostosPrevistosComponent] });
    fixture = TestBed.createComponent(CasoCostosPrevistosComponent);
    fixture.componentRef.setInput('slots', SLOTS);
    fixture.componentInstance.showRegistrados.set(true);
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('cada fila envuelve: nombre arriba e importes/acciones debajo en móvil', async () => {
    await montar(true);
    const fila = filas()[0];
    expect(fila.classList.contains('flex-wrap')).toBe(true);
    expect(fila.classList.contains('sm:flex-nowrap')).toBe(true);
    const importes = fila.lastElementChild!;
    expect(importes.classList.contains('w-full')).toBe(true);
    expect(importes.classList.contains('sm:w-auto')).toBe(true);
  });

  it('el asa de arrastre solo se muestra desde sm (no hay arrastre táctil)', async () => {
    await montar(true);
    const asa = el().querySelector<HTMLElement>('button[aria-label="Arrastrar para reordenar"]')!;
    expect(asa.classList.contains('max-sm:hidden')).toBe(true);
  });

  it('los botones de acción tienen área táctil', async () => {
    await montar(true);
    const registrar = Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Registrar')!;
    expect(registrar.classList.contains('max-sm:tap-target')).toBe(true);
    const quitar = el().querySelector<HTMLElement>('[aria-label="Eliminar movimiento registrado"]')!;
    expect(quitar.classList.contains('max-sm:tap-target')).toBe(true);
  });

  it('la cabecera con progreso envuelve en móvil', async () => {
    await montar(true);
    const cab = el().querySelector('h3')!.parentElement!;
    expect(cab.classList.contains('flex-wrap')).toBe(true);
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
