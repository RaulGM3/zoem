import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccionSelectorComponent } from './accion-selector';
import type { Accion } from '../../../interfaces/accion.interface';

const A = (id: string, nombre: string): Accion =>
  ({ id, nombre, ambito: 'contacto', asunto: '', cuerpo: '', canales: ['gmail'], activa: true, docTemplateId: id === 'a2' ? 't' : undefined }) as Accion;

describe('AccionSelectorComponent', () => {
  let fixture: ComponentFixture<AccionSelectorComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function montar(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [AccionSelectorComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(AccionSelectorComponent);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => vi.clearAllMocks());

  it('es un diálogo accesible y lista las acciones como botones', async () => {
    await montar({ acciones: [A('a1', 'Enviar presupuesto'), A('a2', 'Hoja de encargo')], cargando: false, puedeGestionar: true });
    const d = el().querySelector('[role="dialog"]')!;
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.hasAttribute('appFocusTrap')).toBe(true);
    const btns = el().querySelectorAll<HTMLButtonElement>('[data-testid="opcion-accion"]');
    expect(btns).toHaveLength(2);
    expect(btns[1].textContent).toContain('Documento');
  });

  it('emite la acción elegida', async () => {
    await montar({ acciones: [A('a1', 'Enviar presupuesto')], cargando: false, puedeGestionar: false });
    const spy = vi.fn();
    fixture.componentInstance.elegida.subscribe(spy);
    el().querySelector<HTMLButtonElement>('[data-testid="opcion-accion"]')!.click();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  it('estado vacío con enlace al catálogo solo si puede gestionar', async () => {
    await montar({ acciones: [], cargando: false, puedeGestionar: true });
    expect(el().textContent).toContain('No hay acciones disponibles');
    expect(el().querySelector('a[href="/acciones"]')).not.toBeNull();
    await montar({ acciones: [], cargando: false, puedeGestionar: false });
    expect(el().querySelector('a[href="/acciones"]')).toBeNull();
  });

  it('muestra cargando', async () => {
    await montar({ acciones: [], cargando: true, puedeGestionar: false });
    expect(el().querySelector('[role="status"]')!.textContent).toContain('Cargando');
  });
});
