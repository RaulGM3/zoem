import { describe, it, expect, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Trash2 } from 'lucide-angular';
import { ActionMenuComponent, type MenuAction } from './action-menu';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';

@Component({
  imports: [ActionMenuComponent],
  template: `<app-action-menu [actions]="actions" />`,
})
class HostComponent {
  actions: MenuAction[] = [
    { id: 'edit', label: 'Editar' },
    { id: 'lock', label: 'Bloqueada', disabled: true },
    { id: 'del', label: 'Eliminar', danger: true, icon: Trash2 },
  ];
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

describe('ActionMenuComponent — accesibilidad (axe)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  for (const mobile of [false, true]) {
    for (const abierto of [false, true]) {
      it(`sin violaciones (${mobile ? 'móvil' : 'escritorio'}, ${abierto ? 'abierto' : 'cerrado'})`, async () => {
        mockViewport(mobile);
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        const raiz = fixture.nativeElement as HTMLElement;
        if (abierto) {
          raiz.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
          fixture.detectChanges();
          await fixture.whenStable();
        }
        const violaciones = await analizarA11y(raiz);
        expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
      });
    }
  }
});
