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
});

describe('CasosFilterBarComponent — responsive', () => {
  it('apila los selects en móvil (ancho completo) y los alinea en sm+', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CasosFilterBarComponent] }).compileComponents();
    const f = TestBed.createComponent(CasosFilterBarComponent);
    f.componentRef.setInput('filterEstado', '');
    f.componentRef.setInput('filterTipo', '');
    f.componentRef.setInput('estados', ['pendiente']);
    f.componentRef.setInput('tipos', ['Legal']);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.firstElementChild!.className).toContain('grid-cols-1');
    const selects = el.querySelectorAll('select');
    expect(selects).toHaveLength(2);
    selects.forEach((s) => expect(s.className).toContain('w-full'));
  });
});
