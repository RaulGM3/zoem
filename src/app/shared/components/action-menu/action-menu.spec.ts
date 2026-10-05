import { describe, it, expect, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Trash2 } from 'lucide-angular';
import { ActionMenuComponent, type MenuAction } from './action-menu';

@Component({
  imports: [ActionMenuComponent],
  template: `<app-action-menu [actions]="actions" (selected)="picked.push($event)" />`,
})
class HostComponent {
  actions: MenuAction[] = [
    { id: 'edit', label: 'Editar' },
    { id: 'lock', label: 'Bloqueada', disabled: true },
    { id: 'del', label: 'Eliminar', danger: true, icon: Trash2 },
  ];
  picked: string[] = [];
}

function setup(mobile: boolean): ComponentFixture<HostComponent> {
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
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  return f;
}

const trigger = (f: ComponentFixture<HostComponent>) =>
  f.nativeElement.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
const items = (f: ComponentFixture<HostComponent>) =>
  Array.from(f.nativeElement.querySelectorAll('[role="menuitem"]')) as HTMLElement[];

describe('ActionMenuComponent (desktop)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('trigger has default label, tap-target and aria-expanded=false', () => {
    const f = setup(false);
    const t = trigger(f);
    expect(t.getAttribute('aria-label')).toBe('Más acciones');
    expect(t.classList.contains('tap-target')).toBe(true);
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(f.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('toggles open and closed', () => {
    const f = setup(false);
    trigger(f).click();
    f.detectChanges();
    expect(trigger(f).getAttribute('aria-expanded')).toBe('true');
    expect(f.nativeElement.querySelector('[role="menu"]')).not.toBeNull();
    expect(items(f)).toHaveLength(3);
    trigger(f).click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('selecting emits id and closes', () => {
    const f = setup(false);
    trigger(f).click();
    f.detectChanges();
    items(f)[0].click();
    f.detectChanges();
    expect(f.componentInstance.picked).toEqual(['edit']);
    expect(f.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('disabled action has aria-disabled and does not emit', () => {
    const f = setup(false);
    trigger(f).click();
    f.detectChanges();
    const disabled = items(f)[1];
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    disabled.click();
    f.detectChanges();
    expect(f.componentInstance.picked).toEqual([]);
    expect(f.nativeElement.querySelector('[role="menu"]')).not.toBeNull();
  });

  it('danger action uses the danger color', () => {
    const f = setup(false);
    trigger(f).click();
    f.detectChanges();
    expect(items(f)[2].getAttribute('style')).toContain('var(--danger)');
  });

  it('focuses the first item on open and navigates with arrows', () => {
    const f = setup(false);
    trigger(f).click();
    f.detectChanges();
    const its = items(f);
    expect(document.activeElement).toBe(its[0]);
    const menu = f.nativeElement.querySelector('[role="menu"]') as HTMLElement;
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(its[1]);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(its[0]);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(its[2]);
  });

  it('Escape closes and returns focus to the trigger', () => {
    const f = setup(false);
    trigger(f).click();
    f.detectChanges();
    const menu = f.nativeElement.querySelector('[role="menu"]') as HTMLElement;
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger(f));
  });

  it('outside click closes', () => {
    const f = setup(false);
    trigger(f).click();
    f.detectChanges();
    document.body.click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });
});

describe('ActionMenuComponent (mobile)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('opens a bottom sheet with 48px action rows', () => {
    const f = setup(true);
    trigger(f).click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="menu"]')).toBeNull();
    const dlg = f.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dlg.classList.contains('rounded-t-2xl')).toBe(true);
    const rows = Array.from(dlg.querySelectorAll('button[data-action-id]')) as HTMLElement[];
    expect(rows).toHaveLength(3);
    expect(rows[0].classList.contains('min-h-12')).toBe(true);
  });

  it('selecting a row emits and closes the sheet; disabled does not emit', () => {
    const f = setup(true);
    trigger(f).click();
    f.detectChanges();
    const rows = () => Array.from(f.nativeElement.querySelectorAll('button[data-action-id]')) as HTMLElement[];
    rows()[1].click();
    f.detectChanges();
    expect(f.componentInstance.picked).toEqual([]);
    rows()[2].click();
    f.detectChanges();
    expect(f.componentInstance.picked).toEqual(['del']);
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });
});
