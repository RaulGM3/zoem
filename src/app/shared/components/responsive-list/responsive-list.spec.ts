import { describe, it, expect, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ResponsiveListComponent } from './responsive-list';
import { ListCardDirective, ListTableDirective } from './responsive-list.directives';

interface Row { id: number; name: string }

@Component({
  imports: [ResponsiveListComponent, ListCardDirective, ListTableDirective],
  template: `
    <app-responsive-list [items]="items()" trackBy="id" emptyText="Sin datos">
      <ng-template [appListTable]="items()" let-rows>
        <table id="tbl"><tbody>@for (r of rows; track r.id) { <tr><td>{{ r.name }}</td></tr> }</tbody></table>
      </ng-template>
      <ng-template [appListCard]="items()" let-row let-i="index">
        <div class="card-x">{{ i }}:{{ row.name }}</div>
      </ng-template>
    </app-responsive-list>
  `,
})
class HostComponent {
  readonly items = signal<Row[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }]);
}

function setup(mobile: boolean) {
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

describe('ResponsiveListComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders the table template on desktop with the items', () => {
    const el = setup(false).nativeElement as HTMLElement;
    expect(el.querySelector('#tbl')).not.toBeNull();
    expect(el.querySelectorAll('tr')).toHaveLength(3);
    expect(el.querySelector('ul')).toBeNull();
  });

  it('renders one card per item on mobile with $implicit and index', () => {
    const el = setup(true).nativeElement as HTMLElement;
    expect(el.querySelector('#tbl')).toBeNull();
    const ul = el.querySelector('ul')!;
    expect(ul.getAttribute('role')).toBe('list');
    const lis = el.querySelectorAll('ul > li');
    expect(lis).toHaveLength(3);
    expect(lis[1].textContent?.trim()).toBe('1:B');
  });

  it('shows empty text on desktop and mobile', () => {
    for (const mobile of [false, true]) {
      TestBed.resetTestingModule();
      const f = setup(mobile);
      f.componentInstance.items.set([]);
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Sin datos');
      expect(el.querySelector('#tbl')).toBeNull();
      expect(el.querySelector('ul')).toBeNull();
    }
  });

  it('updates cards when items change', () => {
    const f = setup(true);
    f.componentInstance.items.set([{ id: 9, name: 'Z' }]);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('ul > li')).toHaveLength(1);
  });
});
