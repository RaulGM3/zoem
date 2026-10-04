import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CalendarNavComponent } from './calendar-nav';

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

function setup(mobile: boolean): ComponentFixture<CalendarNavComponent> {
  mockViewport(mobile);
  TestBed.configureTestingModule({ imports: [CalendarNavComponent] });
  const fixture = TestBed.createComponent(CalendarNavComponent);
  fixture.componentRef.setInput('weekDays', []);
  fixture.componentRef.setInput('monthDays', []);
  fixture.componentRef.setInput('viewMode', 'week');
  fixture.componentRef.setInput('weekMonthLabel', 'Marzo 2026');
  fixture.componentRef.setInput('dayNames', ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']);
  fixture.detectChanges();
  return fixture;
}

describe('CalendarNavComponent — móvil', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const btn = (el: HTMLElement, label: string): HTMLButtonElement | null =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

  it('prev/next son botones de icono accesibles con área táctil', () => {
    const el: HTMLElement = setup(true).nativeElement;
    for (const label of ['Anterior', 'Siguiente']) {
      expect(btn(el, label), label).not.toBeNull();
      expect(btn(el, label)!.className).toContain('tap-target');
    }
  });

  it('muestra el botón Hoy solo en móvil y emite todayClicked', () => {
    const f = setup(true);
    const el: HTMLElement = f.nativeElement;
    const spy = vi.fn();
    f.componentInstance.todayClicked.subscribe(() => spy());
    btn(el, 'Ir a hoy')!.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('no muestra el botón Hoy en escritorio', () => {
    const el: HTMLElement = setup(false).nativeElement;
    expect(btn(el, 'Ir a hoy')).toBeNull();
  });

  it('el título se trunca y el selector de vista tiene área táctil', () => {
    const el: HTMLElement = setup(true).nativeElement;
    const titulo = Array.from(el.querySelectorAll('span')).find(s => s.textContent?.trim() === 'Marzo 2026')!;
    expect(titulo.className).toContain('truncate');
    const sem = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Sem')!;
    expect(sem.className).toContain('tap-target');
    expect(sem.getAttribute('aria-pressed')).toBe('true');
  });

  it('emite viewModeChanged, prevClicked y nextClicked', () => {
    const f = setup(true);
    const el: HTMLElement = f.nativeElement;
    const vm = vi.fn();
    const prev = vi.fn();
    const next = vi.fn();
    f.componentInstance.viewModeChanged.subscribe(v => vm(v));
    f.componentInstance.prevClicked.subscribe(() => prev());
    f.componentInstance.nextClicked.subscribe(() => next());
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Mes')!.click();
    btn(el, 'Anterior')!.click();
    btn(el, 'Siguiente')!.click();
    expect(vm).toHaveBeenCalledWith('month');
    expect(prev).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
