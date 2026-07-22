import {
  Directive, ElementRef, OnDestroy, AfterViewInit, inject, output,
} from '@angular/core';

const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Focus trap para modales/drawers `role="dialog"`.
 * Al activarse: mueve el foco al primer control del diálogo, atrapa Tab/Shift+Tab
 * dentro de él, y al destruirse devuelve el foco al elemento que abrió el diálogo.
 * Emite `escapeKey` al pulsar Escape para que el consumidor cierre el diálogo.
 */
@Directive({
  selector: '[appFocusTrap]',
  host: {
    '(keydown.tab)': 'onTab($event)',
    '(keydown.shift.tab)': 'onShiftTab($event)',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class FocusTrapDirective implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private previouslyFocused: HTMLElement | null = null;

  readonly escapeKey = output<void>();

  ngAfterViewInit(): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = this.getFocusable();
    (focusables[0] ?? this.elementRef.nativeElement).focus();
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus?.();
  }

  onEscape(event: Event): void {
    event.stopPropagation();
    this.escapeKey.emit();
  }

  onTab(event: KeyboardEvent): void {
    const focusables = this.getFocusable();
    if (focusables.length === 0) return;
    const last = focusables[focusables.length - 1];
    if (document.activeElement === last) {
      event.preventDefault();
      focusables[0].focus();
    }
  }

  onShiftTab(event: KeyboardEvent): void {
    const focusables = this.getFocusable();
    if (focusables.length === 0) return;
    const first = focusables[0];
    if (document.activeElement === first) {
      event.preventDefault();
      focusables[focusables.length - 1].focus();
    }
  }

  private getFocusable(): HTMLElement[] {
    return Array.from(
      this.elementRef.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
  }
}
