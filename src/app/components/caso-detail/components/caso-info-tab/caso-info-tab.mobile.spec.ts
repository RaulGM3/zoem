import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CasoInfoTabComponent } from './caso-info-tab';
import type { Caso, Contact } from '../../../../interfaces';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const CASO = {
  id: 'c1', titulo: 'Caso 1', descripcion: 'Desc', tipo: 'Legal', estado: 'pendiente', prioridad: 'alta',
  vencimiento: '2026-12-01',
} as unknown as Caso;

describe('CasoInfoTabComponent — responsive', () => {
  let fixture: ComponentFixture<CasoInfoTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(editing: boolean): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [CasoInfoTabComponent] });
    fixture = TestBed.createComponent(CasoInfoTabComponent);
    const set = (k: string, v: unknown): void => fixture.componentRef.setInput(k, v);
    set('caso', CASO);
    set('editing', editing);
    set('saving', false);
    set('linkedContacts', [] as Contact[]);
    set('searchResults', [] as Contact[]);
    set('contactSearch', '');
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('vista: la rejilla de datos es de una columna en móvil y dos desde sm', async () => {
    await montar(false);
    const dl = el().querySelector('dl')!;
    expect(dl.classList.contains('grid-cols-1')).toBe(true);
    expect(dl.classList.contains('sm:grid-cols-2')).toBe(true);
    expect(dl.classList.contains('grid-cols-2')).toBe(false);
  });

  it('edición: la rejilla del formulario es de una columna en móvil y dos desde sm', async () => {
    await montar(true);
    const grid = el().querySelector('.grid')!;
    expect(grid.classList.contains('grid-cols-1')).toBe(true);
    expect(grid.classList.contains('sm:grid-cols-2')).toBe(true);
  });

  it('edición: cada campo tiene label asociado', async () => {
    await montar(true);
    const labels = Array.from(el().querySelectorAll('label'));
    expect(labels.length).toBeGreaterThanOrEqual(6);
    for (const l of labels) expect(el().querySelector(`#${l.htmlFor}`)).not.toBeNull();
  });

  it('edición: sin violaciones axe', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });

  it('vista: sin violaciones axe', async () => {
    await montar(false);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
