import { describe, it, expect, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { OverlayShellComponent } from './overlay-shell';

@Component({
  imports: [OverlayShellComponent],
  template: `
    <app-overlay-shell [open]="open()" [title]="'Mi título'" [variant]="variant()" (closed)="closes = closes + 1">
      <button header-actions type="button" id="ha">Acción</button>
      <p id="body">Cuerpo</p>
      <button footer type="button" id="ft">Guardar</button>
    </app-overlay-shell>
  `,
})
class HostComponent {
  readonly open = signal(true);
  readonly variant = signal<'drawer' | 'modal'>('drawer');
  closes = 0;
}

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

function setup(mobile: boolean): ComponentFixture<HostComponent> {
  mockViewport(mobile);
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

describe('OverlayShellComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders nothing when open=false', () => {
    const f = setup(false);
    f.componentInstance.open.set(false);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('has dialog role, aria-modal and aria-labelledby pointing to the title', () => {
    const f = setup(false);
    const dlg = f.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    const id = dlg.getAttribute('aria-labelledby')!;
    const h = f.nativeElement.querySelector(`#${id}`) as HTMLElement;
    expect(h.textContent).toContain('Mi título');
  });

  it('uses unique title ids per instance', () => {
    const a = setup(false);
    const idA = (a.nativeElement.querySelector('[role="dialog"]') as HTMLElement).getAttribute('aria-labelledby');
    TestBed.resetTestingModule();
    const b = setup(false);
    const idB = (b.nativeElement.querySelector('[role="dialog"]') as HTMLElement).getAttribute('aria-labelledby');
    expect(idA).not.toBe(idB);
  });

  it('emits closed on Escape', () => {
    const f = setup(false);
    const btn = f.nativeElement.querySelector('#ft') as HTMLElement;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(f.componentInstance.closes).toBe(1);
  });

  it('emits closed on backdrop click', () => {
    const f = setup(false);
    (f.nativeElement.querySelector('[data-overlay-backdrop]') as HTMLElement).click();
    expect(f.componentInstance.closes).toBe(1);
  });

  it('does not emit closed when clicking inside the panel', () => {
    const f = setup(false);
    (f.nativeElement.querySelector('#body') as HTMLElement).click();
    expect(f.componentInstance.closes).toBe(0);
  });

  it('emits closed on close button with aria-label Cerrar', () => {
    const f = setup(false);
    const btn = f.nativeElement.querySelector('button[aria-label="Cerrar"]') as HTMLElement;
    expect(btn.classList.contains('tap-target')).toBe(true);
    btn.click();
    expect(f.componentInstance.closes).toBe(1);
  });

  it('projects header actions, body and footer', () => {
    const f = setup(false);
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('#ha')).not.toBeNull();
    expect(el.querySelector('#body')).not.toBeNull();
    const footer = el.querySelector('[data-overlay-footer]') as HTMLElement;
    expect(footer.querySelector('#ft')).not.toBeNull();
    expect(footer.classList.contains('pb-safe')).toBe(true);
    expect(footer.classList.contains('sticky')).toBe(true);
  });

  it('desktop drawer is a right side panel', () => {
    const f = setup(false);
    const dlg = f.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dlg.classList.contains('max-w-lg')).toBe(true);
    expect(dlg.classList.contains('h-dvh')).toBe(false);
  });

  it('desktop modal is a centered dialog', () => {
    const f = setup(false);
    f.componentInstance.variant.set('modal');
    f.detectChanges();
    const dlg = f.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dlg.classList.contains('max-w-md')).toBe(true);
    expect(dlg.classList.contains('rounded-t-2xl')).toBe(false);
  });

  it('mobile modal renders bottom-sheet classes and grab handle', () => {
    const f = setup(true);
    f.componentInstance.variant.set('modal');
    f.detectChanges();
    const dlg = f.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dlg.classList.contains('rounded-t-2xl')).toBe(true);
    expect(dlg.classList.contains('max-h-[90dvh]')).toBe(true);
    expect(f.nativeElement.querySelector('[data-grab-handle]')).not.toBeNull();
  });

  it('mobile drawer is full screen with safe-area top', () => {
    const f = setup(true);
    const dlg = f.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dlg.classList.contains('h-dvh')).toBe(true);
    expect(dlg.classList.contains('pt-safe')).toBe(true);
    expect(f.nativeElement.querySelector('[data-grab-handle]')).toBeNull();
  });
});
