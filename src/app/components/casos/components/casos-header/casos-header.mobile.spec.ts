import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CasosHeaderComponent } from './casos-header';
import { CasosFilterBarComponent } from '../casos-filter-bar/casos-filter-bar';

describe('CasosHeaderComponent — responsive', () => {
  beforeEach(() => TestBed.resetTestingModule());

  async function montar(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [CasosHeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const f = TestBed.createComponent(CasosHeaderComponent);
    f.detectChanges();
    return f.nativeElement;
  }

  it('la cabecera envuelve en móvil y no usa handlers inline de hover', async () => {
    const el = await montar();
    expect(el.firstElementChild!.className).toContain('flex-wrap');
    expect(el.innerHTML).not.toContain('mouseenter');
    expect(el.querySelector('a')!.className).toContain('hover:');
    expect(el.querySelector('button')!.className).toContain('hover:');
  });

  it('los botones tienen área táctil', async () => {
    const el = await montar();
    expect(el.querySelector('a')!.className).toContain('tap-target');
    expect(el.querySelector('button')!.className).toContain('tap-target');
  });

  it('en móvil las acciones ocupan una fila completa con botones repartidos', async () => {
    const el = await montar();
    const acciones = el.querySelector('[data-casos-acciones]')!;
    expect(acciones.className).toContain('w-full');
    expect(acciones.className).toContain('sm:w-auto');
    expect(el.querySelector('a')!.className).toContain('flex-1');
  });
});

describe('CasosFilterBarComponent — responsive', () => {
  it('pone los selects en dos columnas en móvil y los alinea en sm+', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CasosFilterBarComponent] }).compileComponents();
    const f = TestBed.createComponent(CasosFilterBarComponent);
    f.componentRef.setInput('filterEstado', '');
    f.componentRef.setInput('filterTipo', '');
    f.componentRef.setInput('estados', ['pendiente']);
    f.componentRef.setInput('tipos', ['Legal']);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.firstElementChild!.className).toContain('grid-cols-2');
    const selects = el.querySelectorAll('select');
    expect(selects).toHaveLength(2);
    selects.forEach((s) => expect(s.className).toContain('w-full'));
  });

  it('muestra etiquetas legibles para los estados', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CasosFilterBarComponent] }).compileComponents();
    const f = TestBed.createComponent(CasosFilterBarComponent);
    f.componentRef.setInput('filterEstado', '');
    f.componentRef.setInput('filterTipo', '');
    f.componentRef.setInput('estados', ['en_proceso']);
    f.componentRef.setInput('tipos', ['Legal']);
    f.detectChanges();
    const opcion = (f.nativeElement as HTMLElement).querySelector<HTMLOptionElement>('option[value="en_proceso"]')!;
    expect(opcion.textContent!.trim()).toBe('En proceso');
  });
});
