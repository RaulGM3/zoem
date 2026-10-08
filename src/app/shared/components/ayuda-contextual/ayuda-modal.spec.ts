import { describe, it, expect, vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Guia } from '../../../core/ayuda/guia';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';
import { AyudaModalComponent } from './ayuda-modal';

@Component({ template: '' })
class Vacia {}

const CASOS: Guia = {
  id: 'casos',
  titulo: 'Casos',
  modulo: 'Casos',
  ruta: '/casos',
  resumen: 'Los expedientes del despacho.',
  paraQue: 'Seguir cada asunto.',
  aSaber: ['Un caso necesita un cliente.', 'Nada se envía sin confirmar.'],
  claves: [],
  tareas: [
    { id: 'crear', titulo: 'Crear un caso nuevo', pasos: ['Pulsa "Nuevo caso".'], claves: [], nota: 'Hace falta un cliente.' },
    { id: 'buscar', titulo: 'Buscar un caso', pasos: ['Usa los filtros.'], claves: [] },
  ],
};

async function montar(inputs: { guia?: Guia | null; cargando?: boolean; error?: boolean } = {}) {
  TestBed.configureTestingModule({ imports: [AyudaModalComponent], providers: [provideRouter([{ path: '**', component: Vacia }])] });
  const f = TestBed.createComponent(AyudaModalComponent);
  f.componentRef.setInput('open', true);
  f.componentRef.setInput('guia', inputs.guia === undefined ? CASOS : inputs.guia);
  f.componentRef.setInput('cargando', inputs.cargando ?? false);
  f.componentRef.setInput('error', inputs.error ?? false);
  f.detectChanges();
  await f.whenStable();
  return f;
}

const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;
const textos = (f: { nativeElement: HTMLElement }, sel: string) =>
  [...el(f).querySelectorAll(sel)].map(n => n.textContent?.trim() ?? '');

describe('AyudaModalComponent', () => {
  it('es un diálogo titulado con el nombre de la guía', async () => {
    const f = await montar();
    const dialogo = el(f).querySelector('[role="dialog"]');
    const titulo = el(f).querySelector(`#${dialogo?.getAttribute('aria-labelledby')}`);
    expect(titulo?.textContent).toContain('Casos');
  });

  it('proyecta qué hace la pantalla y para qué sirve', async () => {
    const f = await montar();
    expect(el(f).textContent).toContain('Los expedientes del despacho.');
    expect(el(f).textContent).toContain('Seguir cada asunto.');
  });

  it('lista lo que hay que saber', async () => {
    const f = await montar();
    expect(textos(f, '[data-a-saber] li')).toEqual(['Un caso necesita un cliente.', 'Nada se envía sin confirmar.']);
  });

  it('muestra cada tarea plegada con sus pasos y su nota', async () => {
    const f = await montar();
    expect(textos(f, 'details summary')).toEqual(['Crear un caso nuevo', 'Buscar un caso']);
    const primera = el(f).querySelector('details');
    expect(primera?.querySelector('ol li')?.textContent).toContain('Pulsa "Nuevo caso".');
    expect(primera?.textContent).toContain('Hace falta un cliente.');
  });

  it('enlaza a la guía completa y se cierra al seguir el enlace', async () => {
    const f = await montar();
    const cerrado = vi.fn();
    f.componentInstance.closed.subscribe(cerrado);
    const enlace = el(f).querySelector<HTMLAnchorElement>('a[href="/ayuda/casos"]');
    expect(enlace?.textContent).toContain('Ver guía completa');
    enlace?.click();
    await f.whenStable();
    expect(cerrado).toHaveBeenCalled();
  });

  it('avisa mientras carga', async () => {
    const f = await montar({ guia: null, cargando: true });
    expect(el(f).querySelector('[role="status"]')?.textContent).toContain('Cargando');
  });

  it('si falla la carga ofrece reintentar', async () => {
    const f = await montar({ guia: null, error: true });
    const reintentar = vi.fn();
    f.componentInstance.reintentar.subscribe(reintentar);
    const alerta = el(f).querySelector('[role="alert"]');
    expect(alerta).not.toBeNull();
    alerta?.querySelector('button')?.click();
    expect(reintentar).toHaveBeenCalled();
  });
});

describe('AyudaModalComponent — accesibilidad (axe)', () => {
  it('no tiene violaciones mostrando una guía', async () => {
    const f = await montar();
    const v = await analizarA11y(f.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });

  it('no tiene violaciones en el error de carga', async () => {
    const f = await montar({ guia: null, error: true });
    const v = await analizarA11y(f.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });
});
