import { describe, it, expect, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayShellComponent } from './overlay-shell';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';

@Component({
  imports: [OverlayShellComponent],
  template: `
    <app-overlay-shell [open]="true" title="Título" [variant]="variant()">
      <button header-actions type="button">Editar</button>
      <p>Contenido</p>
      <button footer type="button">Guardar</button>
    </app-overlay-shell>
  `,
})
class HostComponent {
  readonly variant = signal<'drawer' | 'modal'>('drawer');
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

describe('OverlayShellComponent — accesibilidad (axe)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  for (const mobile of [false, true]) {
    for (const variant of ['drawer', 'modal'] as const) {
      it(`sin violaciones (${mobile ? 'móvil' : 'escritorio'}, ${variant})`, async () => {
        mockViewport(mobile);
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.variant.set(variant);
        fixture.detectChanges();
        await fixture.whenStable();
        const violaciones = await analizarA11y(fixture.nativeElement as HTMLElement);
        expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
      });
    }
  }
});
