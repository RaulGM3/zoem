import { Directive, TemplateRef, inject, input } from '@angular/core';

export interface ListCardContext<T> {
  $implicit: T;
  index: number;
}

export interface ListTableContext<T> {
  $implicit: readonly T[];
}

/**
 * Marca el `ng-template` de la tarjeta móvil: `let-item let-i="index"`.
 * Enlazar `[appListCard]="items()"` solo sirve para tipar el contexto (T); es opcional.
 */
@Directive({ selector: 'ng-template[appListCard]' })
export class ListCardDirective<T = unknown> {
  readonly typeHint = input<readonly T[] | ''>('', { alias: 'appListCard' });
  readonly template = inject<TemplateRef<ListCardContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(_dir: ListCardDirective<T>, _ctx: unknown): _ctx is ListCardContext<T> {
    return true;
  }
}

/**
 * Marca el `ng-template` de la tabla de escritorio: `let-items`.
 * Enlazar `[appListTable]="items()"` solo sirve para tipar el contexto (T); es opcional.
 */
@Directive({ selector: 'ng-template[appListTable]' })
export class ListTableDirective<T = unknown> {
  readonly typeHint = input<readonly T[] | ''>('', { alias: 'appListTable' });
  readonly template = inject<TemplateRef<ListTableContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(_dir: ListTableDirective<T>, _ctx: unknown): _ctx is ListTableContext<T> {
    return true;
  }
}
