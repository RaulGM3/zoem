import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';

let nextId = 0;

/** Distancia (px) que hay que arrastrar hacia abajo para cerrar la hoja. */
const SWIPE_CLOSE_PX = 120;
/** Movimiento mínimo antes de capturar el puntero (permite clics en el header). */
const DRAG_SLOP_PX = 4;
/** Duración de la animación de salida tras un swipe. */
const DISMISS_MS = 200;

/**
 * Contenedor responsive para drawers y modales.
 * Escritorio: ambos son diálogos centrados; `drawer` es más ancho (formularios largos).
 * Móvil: drawer = pantalla completa, modal = bottom sheet. Ambos suben desde abajo
 * y se cierran arrastrando la cabecera hacia abajo.
 */
@Component({
  selector: 'app-overlay-shell',
  imports: [LucideAngularModule, FocusTrapDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex" [class]="rootClass()">
        <div class="absolute inset-0 bg-black/40" data-overlay-backdrop aria-hidden="true"
          (click)="closed.emit()"></div>
        <div role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId"
          appFocusTrap (escapeKey)="closed.emit()"
          class="relative flex flex-col shadow-2xl" [class]="panelClass()"
          [style.transform]="sheet() ? transform() : null"
          [style.transition]="sheet() && !dragging() ? 'transform ' + dismissMs + 'ms ease-out' : null"
          style="background:var(--popover)">
          <div class="shrink-0" [class.touch-none]="sheet()" [class.select-none]="sheet()"
            [attr.data-drag-zone]="sheet() ? '' : null"
            (pointerdown)="onDragStart($event)" (pointermove)="onDragMove($event)"
            (pointerup)="onDragEnd()" (pointercancel)="onDragEnd()">
            @if (sheet()) {
              <div class="flex justify-center pt-2" data-grab-handle aria-hidden="true">
                <span class="h-1 w-10 rounded-full" style="background:var(--border)"></span>
              </div>
            }
            <div class="flex items-center justify-between gap-2 px-5 py-4"
              style="border-bottom:1px solid var(--border)">
              <div class="min-w-0">
                <h2 [id]="titleId" class="truncate text-base font-semibold"
                  style="color:var(--text-strong);font-family:var(--font-display)">{{ title() }}</h2>
                @if (subtitle()) {
                  <p class="mt-0.5 text-xs" style="color:var(--text-muted)">{{ subtitle() }}</p>
                }
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <ng-content select="[header-actions]" />
                <button type="button" aria-label="Cerrar" (click)="closed.emit()"
                  class="tap-target inline-flex items-center justify-center rounded-xl p-1.5 transition-colors duration-150 hover:bg-[var(--surface-2)]"
                  style="color:var(--text-muted)">
                  <lucide-icon [img]="XIcon" size="18" aria-hidden="true"></lucide-icon>
                </button>
              </div>
            </div>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ng-content />
          </div>
          <div data-overlay-footer
            class="sticky bottom-0 pb-safe empty:hidden"
            style="background:var(--popover);border-top:1px solid var(--border)">
            <ng-content select="[footer]" />
          </div>
        </div>
      </div>
    }

  `,
})
export class OverlayShellComponent {
  private readonly bp = inject(BreakpointService);
  protected readonly XIcon = X;
  protected readonly titleId = `overlay-shell-title-${nextId++}`;
  protected readonly dismissMs = DISMISS_MS;

  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
  readonly variant = input<'drawer' | 'modal'>('drawer');
  readonly size = input<'md' | 'lg' | undefined>(undefined);
  readonly closed = output<void>();

  /** En móvil todo overlay es una hoja que sube desde abajo. */
  protected readonly sheet = computed(() => this.bp.isMobile());

  protected readonly dragging = signal(false);
  private readonly dragY = signal(0);
  private readonly dismissing = signal(false);
  private startY: number | null = null;

  protected readonly transform = computed(() =>
    this.dismissing() ? 'translateY(100%)' : `translateY(${this.dragY()}px)`,
  );

  private readonly maxWidth = computed(() => {
    const drawer = this.variant() === 'drawer';
    const size = this.size() ?? (drawer ? 'lg' : 'md');
    if (drawer) return size === 'lg' ? 'max-w-3xl' : 'max-w-2xl';
    return size === 'lg' ? 'max-w-lg' : 'max-w-md';
  });

  protected readonly rootClass = computed(() =>
    this.sheet() ? 'items-end' : 'items-center justify-center p-4',
  );

  protected readonly panelClass = computed(() => {
    if (!this.sheet()) return `w-full ${this.maxWidth()} max-h-[90dvh] rounded-xl animate-modal-in`;
    return this.variant() === 'drawer'
      ? 'h-dvh w-full pt-safe animate-sheet-up'
      : 'w-full max-h-[90dvh] rounded-t-2xl animate-sheet-up';
  });

  protected onDragStart(event: PointerEvent): void {
    if (!this.sheet()) return;
    const target = event.target as Element | null;
    if (target?.closest('button, a, input, select, textarea')) return;
    this.startY = event.clientY;
  }

  protected onDragMove(event: PointerEvent): void {
    if (this.startY === null) return;
    const dy = Math.max(0, event.clientY - this.startY);
    if (!this.dragging()) {
      if (dy < DRAG_SLOP_PX) return;
      this.dragging.set(true);
      (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    }
    this.dragY.set(dy);
  }

  protected onDragEnd(): void {
    if (this.startY === null) return;
    this.startY = null;
    const shouldClose = this.dragY() > SWIPE_CLOSE_PX;
    this.dragging.set(false);
    if (!shouldClose) {
      this.dragY.set(0);
      return;
    }
    this.dismissing.set(true);
    setTimeout(() => {
      this.closed.emit();
      this.dismissing.set(false);
      this.dragY.set(0);
    }, DISMISS_MS);
  }
}
