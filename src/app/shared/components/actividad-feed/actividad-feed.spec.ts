import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ActividadFeedComponent } from './actividad-feed';
import type { Actividad } from '../../../interfaces/actividad';

function actividades(n: number): Actividad[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `a-${i}`,
    companyId: 'c-1',
    autorId: 'u-1',
    autorNombre: 'Ana',
    accion: `Hizo algo ${i}`,
    modulo: 'Casos',
    createdAt: undefined as never,
  }));
}

describe('ActividadFeedComponent', () => {
  let fixture: ComponentFixture<ActividadFeedComponent>;
  let component: ActividadFeedComponent;

  function montar(items: Actividad[]) {
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ActividadFeedComponent] }).compileComponents();
    fixture = TestBed.createComponent(ActividadFeedComponent);
    component = fixture.componentInstance;
  });

  it('muestra como mucho 10 actividades por página', () => {
    montar(actividades(25));

    expect(component.visibles().length).toBe(10);
    expect(component.visibles()[0].id).toBe('a-0');
  });

  it('calcula el total de páginas a partir del feed', () => {
    montar(actividades(25));

    expect(component.totalPaginas()).toBe(3);
    expect(component.pagina()).toBe(1);
  });

  it('pasa a los siguientes 10 y vuelve atrás', () => {
    montar(actividades(25));

    component.siguiente();
    expect(component.pagina()).toBe(2);
    expect(component.visibles()[0].id).toBe('a-10');
    expect(component.visibles().at(-1)!.id).toBe('a-19');

    component.anterior();
    expect(component.visibles()[0].id).toBe('a-0');
  });

  it('no se pasa de los límites', () => {
    montar(actividades(25));

    component.anterior();
    expect(component.pagina()).toBe(1);

    component.siguiente();
    component.siguiente();
    component.siguiente();
    expect(component.pagina()).toBe(3);
    expect(component.visibles().length).toBe(5);
  });

  it('con una sola página no pinta el paginador', () => {
    montar(actividades(4));

    expect(component.totalPaginas()).toBe(1);
    expect(component.visibles().length).toBe(4);
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });

  it('pinta el paginador cuando hay más de una página', () => {
    montar(actividades(25));

    const nav: HTMLElement = fixture.nativeElement.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav.textContent).toContain('Página 1 de 3');
  });

  it('sin actividad muestra el mensaje vacío y no explota', () => {
    montar([]);

    expect(component.totalPaginas()).toBe(1);
    expect(component.visibles()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Sin actividad reciente');
  });

  it('satura la página si el feed encoge en vivo', () => {
    montar(actividades(25));
    component.siguiente();
    component.siguiente();
    expect(component.pagina()).toBe(3);

    montar(actividades(5));

    expect(component.pagina()).toBe(1);
    expect(component.visibles().length).toBe(5);
  });

  it('respeta un tamaño de página distinto', () => {
    fixture.componentRef.setInput('porPagina', 5);
    montar(actividades(12));

    expect(component.visibles().length).toBe(5);
    expect(component.totalPaginas()).toBe(3);
  });
});
