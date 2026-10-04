import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CasoHitosTabComponent } from './caso-hitos-tab';
import type { CompanyMember, Hito } from '../../../../interfaces';
import { mockViewport } from '../../mock-viewport';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const HITOS = [
  {
    id: 'h1', titulo: 'Presentar demanda', descripcion: 'Antes de fin de mes', estado: 'pendiente',
    fechaEstimada: '2026-11-01', asignadosA: ['u1', 'u2'],
    registrosHoras: [{ minutos: 90, facturado: false }],
  },
  { id: 'h2', titulo: 'Notificar', estado: 'completado', registrosHoras: [{ minutos: 60, facturado: true }] },
] as unknown as Hito[];

const MEMBERS = [
  { userId: 'u1', nombre: 'Ana', apellido: 'Ruiz' },
  { userId: 'u2', nombre: 'Luis' },
] as unknown as CompanyMember[];

describe('CasoHitosTabComponent — móvil', () => {
  let fixture: ComponentFixture<CasoHitosTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const filas = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('ul > li'));

  async function montar(mobile: boolean, inputs: Record<string, unknown> = {}): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [CasoHitosTabComponent] });
    fixture = TestBed.createComponent(CasoHitosTabComponent);
    fixture.componentRef.setInput('hitos', HITOS);
    fixture.componentRef.setInput('actividad', []);
    fixture.componentRef.setInput('members', MEMBERS);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    await fixture.whenStable();
  }

  async function elegir(fila: HTMLElement, id: string): Promise<void> {
    fila.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    el().querySelector<HTMLButtonElement>(`[data-action-id="${id}"]`)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('acciones: facturar solo con horas pendientes, editar y eliminar según permisos', async () => {
    await montar(true);
    const c = fixture.componentInstance;
    expect(c.acciones(HITOS[0]).map((a) => a.id)).toEqual(['facturar', 'edit', 'delete']);
    expect(c.acciones(HITOS[1]).map((a) => a.id)).toEqual(['edit', 'delete']);
    fixture.componentRef.setInput('canDelete', false);
    expect(c.acciones(HITOS[1]).map((a) => a.id)).toEqual(['edit']);
    fixture.componentRef.setInput('canEdit', false);
    expect(c.acciones(HITOS[0])).toEqual([]);
  });

  it('móvil: un menú por hito en lugar de los iconos que solo aparecen con hover', async () => {
    await montar(true);
    expect(filas()).toHaveLength(2);
    for (const f of filas()) expect(f.querySelectorAll('button[aria-haspopup="menu"]')).toHaveLength(1);
    expect(el().querySelector('[aria-label="Editar hito"]')).toBeNull();
  });

  it('escritorio: iconos inline y sin menú', async () => {
    await montar(false);
    expect(el().querySelector('button[aria-haspopup="menu"]')).toBeNull();
    expect(el().querySelectorAll('[aria-label="Editar hito"]')).toHaveLength(2);
  });

  it('móvil: sin permisos no hay menú', async () => {
    await montar(true, { canEdit: false, canDelete: false });
    expect(el().querySelector('button[aria-haspopup="menu"]')).toBeNull();
  });

  it('móvil: las acciones emiten los mismos outputs que escritorio', async () => {
    await montar(true);
    const out: string[] = [];
    const c = fixture.componentInstance;
    c.facturarHoras.subscribe((h) => out.push(`facturar:${h.id}`));
    c.editHito.subscribe((h) => out.push(`edit:${h.id}`));
    c.deleteHito.subscribe((id) => out.push(`delete:${id}`));
    await elegir(filas()[0], 'facturar');
    await elegir(filas()[0], 'edit');
    await elegir(filas()[0], 'delete');
    expect(filas()[0].textContent).toContain('¿Seguro?');
    filas()[0].querySelector<HTMLButtonElement>('[aria-label="Confirmar eliminación del hito"]')!.click();
    fixture.detectChanges();
    expect(out).toEqual(['facturar:h1', 'edit:h1', 'delete:h1']);
  });

  it('móvil: cancelar la confirmación restaura el menú', async () => {
    await montar(true);
    await elegir(filas()[0], 'delete');
    filas()[0].querySelector<HTMLButtonElement>('[aria-label="Cancelar"]')!.click();
    fixture.detectChanges();
    expect(filas()[0].querySelector('button[aria-haspopup="menu"]')).not.toBeNull();
  });

  it('los metadatos (fecha, asignados, horas) se apilan/envuelven', async () => {
    await montar(true);
    const meta = filas()[0].querySelector<HTMLElement>('[data-hito-meta]')!;
    expect(meta.classList.contains('flex-wrap')).toBe(true);
    expect(meta.textContent).toContain('2026-11-01');
    expect(meta.textContent).toContain('Ana Ruiz, Luis');
    expect(meta.textContent).toContain('1.5h');
  });

  it('el botón de estado tiene área táctil', async () => {
    await montar(true);
    const toggle = filas()[0].querySelector<HTMLElement>('button[aria-label^="Cambiar estado"]')!;
    expect(toggle.classList.contains('max-sm:tap-target')).toBe(true);
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
