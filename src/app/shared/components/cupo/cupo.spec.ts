import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CupoComponent } from './cupo';

function montar(usado: number, limite: number) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [CupoComponent] });
  const f = TestBed.createComponent(CupoComponent);
  f.componentRef.setInput('etiqueta', 'plantillas');
  f.componentRef.setInput('usado', usado);
  f.componentRef.setInput('limite', limite);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('CupoComponent', () => {
  it('muestra "3/5 plantillas"', () => {
    expect(montar(3, 5).textContent).toContain('3/5 plantillas');
  });
  it('expone el estado para estilos y tests', () => {
    expect(montar(3, 5).querySelector('[data-estado]')?.getAttribute('data-estado')).toBe('ok');
    expect(montar(4, 5).querySelector('[data-estado]')?.getAttribute('data-estado')).toBe('aviso');
    expect(montar(5, 5).querySelector('[data-estado]')?.getAttribute('data-estado')).toBe('agotado');
  });
  it('aviso y agotado llevan texto (no solo color)', () => {
    expect(montar(4, 5).textContent).toContain('Casi al límite');
    expect(montar(5, 5).textContent).toContain('Límite alcanzado');
  });
  it('ilimitado no se muestra', () => {
    expect(montar(10, Infinity).querySelector('[data-estado]')).toBeNull();
  });
  it('barra de progreso accesible', () => {
    const bar = montar(3, 5).querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.getAttribute('aria-valuemax')).toBe('5');
  });
});
