import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, inject, input, output, signal,
  viewChild,
} from '@angular/core';
import { LucideAngularModule, Ellipsis, type LucideIconData } from 'lucide-angular';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { OverlayShellComponent } from '../overlay-shell/overlay-shell';

export interface MenuAction {
  id: string;
  label: string;
  icon?: LucideIconData;
  disabled?: boolean;
  danger?: boolean;
}

/**
 * Menú de acciones "⋯". Escritorio: popover con role="menu".
 * Móvil: bottom sheet (overlay-shell modal) con filas de 48px.
 */
@Component({
  selector: 'app-action-menu',
  imports: [LucideAngularModule, OverlayShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative inline-block',
    '(document:click)': 'onDocumentClick($event)',
  },
  template: `
    <button #trigger type="button" aria-haspopup="menu" [attr.aria-expanded]="isOpen()"
      [attr.aria-label]="label()" (click)="toggle()"
      class="tap-target inline-flex items-center justify-center rounded-lg p-1.5 transition-colors duration-150 hover:bg-[var(--surface-2)]"
      style="color:var(--text-muted)">
      <lucide-icon [img]="EllipsisIcon" size="18" aria-hidden="true"></lucide-icon>
    </button>

    @if (bp.isMobile()) {
      <app-overlay-shell [open]="isOpen()" [title]="label()" variant="modal" (closed)="close()">
        <div class="py-1">
          @for (a of actions(); track a.id) {
            <button type="button" [attr.data-action-id]="a.id" [attr.aria-disabled]="a.disabled ? 'true' : null"
              (click)="choose(a)"
              class="flex min-h-12 w-full items-center gap-3 px-5 text-left text-sm"
              [class.opacity-50]="a.disabled"
              [style.color]="a.danger ? 'var(--danger)' : 'var(--text-body)'">
              @if (a.icon) {
                <lucide-icon [img]="a.icon" size="18" aria-hidden="true"></lucide-icon>
              }
              {{ a.label }}
            </button>
          }
        </div>
      </app-overlay-shell>
    } @else if (isOpen()) {
      <div role="menu" [attr.aria-label]="label()" (keydown)="onMenuKeydown($event)"
        class="absolute right-0 top-full z-50 mt-1 min-w-44 rounded-xl py-1 shadow-2xl"
        style="background:var(--popover);border:1px solid var(--border)">
        @for (a of actions(); track a.id) {
          <button type="button" role="menuitem" tabindex="-1" [attr.aria-disabled]="a.disabled ? 'true' : null"
            (click)="choose(a)"
            class="flex min-h-9 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)]"
            [class.opacity-50]="a.disabled"
            [style.color]="a.danger ? 'var(--danger)' : 'var(--text-body)'">
            @if (a.icon) {
              <lucide-icon [img]="a.icon" size="16" aria-hidden="true"></lucide-icon>
            }
            {{ a.label }}
          </button>
        }
      </div>
    }
  `,
})
export class ActionMenuComponent {
  protected readonly bp = inject(BreakpointService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  protected readonly EllipsisIcon = Ellipsis;

  readonly actions = input.required<readonly MenuAction[]>();
  readonly label = input('Más acciones');
  readonly selected = output<string>();

  protected readonly isOpen = signal(false);

  protected toggle(): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.isOpen.set(true);
    if (!this.bp.isMobile()) {
      afterNextRender(() => this.menuItems()[0]?.focus(), { injector: this.injector });
    }
  }

  protected close(restoreFocus = false): void {
    this.isOpen.set(false);
    if (restoreFocus) this.trigger().nativeElement.focus();
  }

  protected choose(action: MenuAction): void {
    if (action.disabled) return;
    this.selected.emit(action.id);
    this.close(!this.bp.isMobile());
  }

  protected onDocumentClick(event: Event): void {
    if (this.isOpen() && !this.bp.isMobile() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const items = this.menuItems();
    const idx = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        items[(idx + 1) % items.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  private menuItems(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }
}
