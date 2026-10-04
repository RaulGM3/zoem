import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ItemDetalleDialogComponent } from './item-detalle-dialog';
import { ToastService } from '../../../../core/services/toast.service';
import { evento, hito } from '../../testing/calendario-fixtures';
import type { CalendarItem } from '../../calendario.types';

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

function setup(mobile: boolean, item: CalendarItem): ComponentFixture<ItemDetalleDialogComponent> {
  mockViewport(mobile);
  TestBed.configureTestingModule({
    imports: [ItemDetalleDialogComponent],
    providers: [{ provide: ToastService, useValue: { info: vi.fn() } }],
  });
  const fixture = TestBed.createComponent(ItemDetalleDialogComponent);
  fixture.componentRef.setInput('item', item);
  fixture.detectChanges();
  return fixture;
}

describe('ItemDetalleDialogComponent — overlay-shell', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('se renderiza dentro de app-overlay-shell como bottom sheet en móvil', () => {
    const f = setup(true, evento());
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('app-overlay-shell')).not.toBeNull();
    expect(el.querySelector('[data-grab-handle]')).not.toBeNull();
    expect(el.querySelector('[role="dialog"]')!.className).toContain('rounded-t-2xl');
  });

  it('se renderiza como diálogo centrado en escritorio (sin grab handle)', () => {
    const f = setup(false, evento());
    expect((f.nativeElement as HTMLElement).querySelector('[data-grab-handle]')).toBeNull();
  });

  it('el botón Eliminar evento vive en el footer del shell y pide confirmación', () => {
    const f = setup(true, evento());
    const el: HTMLElement = f.nativeElement;
    const footer = el.querySelector('[data-overlay-footer]')!;
    const eliminar = footer.querySelector<HTMLButtonElement>('button[aria-label="Eliminar evento"]');
    expect(eliminar).not.toBeNull();
    eliminar!.click();
    f.detectChanges();
    expect(el.querySelectorAll('[role="dialog"]').length).toBe(2);
  });

  it('no hay acción de eliminar para un hito', () => {
    const f = setup(true, hito());
    expect((f.nativeElement as HTMLElement).querySelector('button[aria-label="Eliminar evento"]')).toBeNull();
  });

  it('emite closed al pulsar el backdrop y con Escape', () => {
    const f = setup(true, evento());
    const spy = vi.fn();
    f.componentInstance.closed.subscribe(() => spy());
    const el: HTMLElement = f.nativeElement;
    el.querySelector<HTMLElement>('[data-overlay-backdrop]')!.click();
    expect(spy).toHaveBeenCalledTimes(1);
    el.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('los controles de estado tienen área táctil', () => {
    const f = setup(true, evento());
    const el: HTMLElement = f.nativeElement;
    const estado = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Confirmado')!;
    expect(estado.className).toContain('tap-target');
  });
});
