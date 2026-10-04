import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NuevoEventoDrawerComponent } from './nuevo-evento-drawer';
import { UsersService } from '../../../../core/services/users';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

function mockViewport(mobile: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: mobile && /max-width/.test(q),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

function setup(mobile: boolean, visible = true): ComponentFixture<NuevoEventoDrawerComponent> {
  mockViewport(mobile);
  TestBed.configureTestingModule({
    imports: [NuevoEventoDrawerComponent],
    providers: [{ provide: UsersService, useValue: { members: signal([]), loadMembers: vi.fn() } }],
  });
  const fixture = TestBed.createComponent(NuevoEventoDrawerComponent);
  fixture.componentRef.setInput('visible', visible);
  fixture.componentRef.setInput('saving', false);
  fixture.detectChanges();
  return fixture;
}

describe('NuevoEventoDrawerComponent — overlay-shell', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('no renderiza nada si no está visible', () => {
    const f = setup(true, false);
    expect((f.nativeElement as HTMLElement).querySelector('[role="dialog"]')).toBeNull();
  });

  it('en móvil ocupa la pantalla completa (drawer de overlay-shell)', () => {
    const el: HTMLElement = setup(true).nativeElement;
    expect(el.querySelector('app-overlay-shell')).not.toBeNull();
    expect(el.querySelector('[role="dialog"]')!.className).toContain('h-dvh');
  });

  it('en escritorio es un diálogo centrado', () => {
    const el: HTMLElement = setup(false).nativeElement;
    expect(el.querySelector('[role="dialog"]')!.className).toContain('rounded-xl');
  });

  it('emite closed con Cancelar, backdrop y Escape', () => {
    const f = setup(true);
    const spy = vi.fn();
    f.componentInstance.closed.subscribe(() => spy());
    const el: HTMLElement = f.nativeElement;
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Cancelar')!.click();
    el.querySelector<HTMLElement>('[data-overlay-backdrop]')!.click();
    el.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('el botón Crear evento vive en el footer y emite saved con los datos', () => {
    const f = setup(true);
    const el: HTMLElement = f.nativeElement;
    const spy = vi.fn();
    f.componentInstance.saved.subscribe(d => spy(d));
    const footer = el.querySelector('[data-overlay-footer]')!;
    const crear = Array.from(footer.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Crear evento')!;
    expect(crear.disabled).toBe(true);
    f.componentInstance.titulo.set('Reunión');
    f.componentInstance.fecha.set('2026-03-10');
    f.detectChanges();
    expect(crear.disabled).toBe(false);
    crear.click();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Reunión', fecha: '2026-03-10' }));
  });

  it('los campos de fecha/hora se apilan en 2 columnas en móvil', () => {
    const el: HTMLElement = setup(true).nativeElement;
    const grid = el.querySelector<HTMLElement>('#ev-fecha')!.closest('.grid')!;
    expect(grid.className).toContain('grid-cols-2');
    expect(grid.className).toContain('sm:grid-cols-3');
  });

  it('sin violaciones axe en móvil', async () => {
    const f = setup(true);
    await f.whenStable();
    const violaciones = await analizarA11y(f.nativeElement as HTMLElement);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
