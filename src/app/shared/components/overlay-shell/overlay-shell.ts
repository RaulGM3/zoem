import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';

let nextId = 0;

/**
 * Contenedor responsive para drawers y modales.
 * Escritorio: drawer = panel lateral derecho, modal = diálogo centrado.
 * Móvil: drawer = pantalla completa, modal = bottom sheet.
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
          style="background:var(--popover)">
          @if (sheet()) {
            <div class="flex justify-center pt-2" data-grab-handle aria-hidden="true">
              <span class="h-1 w-10 rounded-full" style="background:var(--border)"></span>
            </div>
          }
          <div class="flex items-center justify-between gap-2 px-5 py-4"
            style="border-bottom:1px solid var(--border)">
            <h2 [id]="titleId" class="text-base font-semibold"
              style="color:var(--text-strong);font-family:var(--font-display)">{{ title() }}</h2>
            <div class="flex items-center gap-1">
              <ng-content select="[header-actions]" />
              <button type="button" aria-label="Cerrar" (click)="closed.emit()"
                class="tap-target inline-flex items-center justify-center rounded-xl p-1.5 transition-colors duration-150 hover:bg-[var(--surface-2)]"
                style="color:var(--text-muted)">
                <lucide-icon [img]="XIcon" size="18" aria-hidden="true"></lucide-icon>
              </button>
            </div>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto">
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

  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly variant = input<'drawer' | 'modal'>('drawer');
  readonly size = input<'md' | 'lg' | undefined>(undefined);
  readonly closed = output<void>();

  protected readonly sheet = computed(() => this.bp.isMobile() && this.variant() === 'modal');

  private readonly maxWidth = computed(() => {
    const size = this.size() ?? (this.variant() === 'drawer' ? 'lg' : 'md');
    return size === 'lg' ? 'max-w-lg' : 'max-w-md';
  });

  protected readonly rootClass = computed(() => {
    if (this.variant() === 'drawer') return this.bp.isMobile() ? '' : 'justify-end';
    return this.bp.isMobile() ? 'items-end' : 'items-center justify-center p-4';
  });

  protected readonly panelClass = computed(() => {
    const mobile = this.bp.isMobile();
    if (this.variant() === 'drawer') {
      return mobile ? 'h-dvh w-full pt-safe' : `h-full w-full ${this.maxWidth()}`;
    }
    return mobile
      ? 'w-full max-h-[90dvh] rounded-t-2xl'
      : `w-full ${this.maxWidth()} max-h-[90dvh] rounded-xl`;
  });
}
