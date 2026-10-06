import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SkeletonComponent } from './skeleton';

describe('SkeletonComponent', () => {
  let fixture: ComponentFixture<SkeletonComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const filas = () => host().querySelectorAll('[data-skeleton-fila]');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SkeletonComponent] });
    fixture = TestBed.createComponent(SkeletonComponent);
  });

  function set(inputs: Record<string, unknown>) {
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  it('se anuncia como región ocupada con texto solo para lectores de pantalla', () => {
    set({ etiqueta: 'Cargando casos...' });
    expect(host().getAttribute('role')).toBe('status');
    expect(host().getAttribute('aria-busy')).toBe('true');
    const texto = host().querySelector('.sr-only');
    expect(texto?.textContent?.trim()).toBe('Cargando casos...');
  });

  it('usa "Cargando…" como etiqueta por defecto', () => {
    set({});
    expect(host().querySelector('.sr-only')?.textContent?.trim()).toBe('Cargando…');
  });

  it('oculta los bloques decorativos a la tecnología de asistencia', () => {
    set({});
    expect(host().querySelector('[data-skeleton]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it.each(['lista', 'tabla', 'detalle'] as const)('renderiza la variante %s', (variante) => {
    set({ variante });
    expect(host().querySelector('[data-skeleton]')?.getAttribute('data-skeleton')).toBe(variante);
  });

  it('pinta tantas filas como se pidan', () => {
    set({ variante: 'tabla', filas: 3 });
    expect(filas().length).toBe(3);
  });

  it('pinta al menos una fila aunque se pidan 0', () => {
    set({ variante: 'lista', filas: 0 });
    expect(filas().length).toBe(1);
  });
});
