import { ChangeDetectionStrategy, Component, contentChild, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { ListCardDirective, ListTableDirective } from './responsive-list.directives';

export { ListCardDirective, ListTableDirective } from './responsive-list.directives';
export type { ListCardContext, ListTableContext } from './responsive-list.directives';

/**
 * Lista adaptable: tabla en escritorio (template `appListTable`),
 * tarjetas en móvil (template `appListCard`).
 */
@Component({
  selector: 'app-responsive-list',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length === 0) {
      <p class="py-8 text-center text-sm" style="color:var(--text-faint)">{{ emptyText() }}</p>
    } @else if (bp.isMobile()) {
      <ul role="list" class="space-y-3">
        @for (item of items(); track key(item, $index); let i = $index) {
          <li>
            <ng-container
              [ngTemplateOutlet]="card()?.template ?? null"
              [ngTemplateOutletContext]="{ $implicit: item, index: i }" />
          </li>
        }
      </ul>
    } @else {
      <ng-container
        [ngTemplateOutlet]="table()?.template ?? null"
        [ngTemplateOutletContext]="{ $implicit: items() }" />
    }
  `,
})
export class ResponsiveListComponent<T> {
  protected readonly bp = inject(BreakpointService);

  readonly items = input.required<readonly T[]>();
  /** Nombre de propiedad o función que devuelve la clave de identidad. */
  readonly trackBy = input<keyof T | ((item: T, index: number) => unknown)>();
  readonly emptyText = input('No hay elementos');

  protected readonly card = contentChild(ListCardDirective);
  protected readonly table = contentChild(ListTableDirective);

  protected key(item: T, index: number): unknown {
    const t = this.trackBy();
    if (t === undefined) return item;
    return typeof t === 'function' ? t(item, index) : item[t];
  }
}
