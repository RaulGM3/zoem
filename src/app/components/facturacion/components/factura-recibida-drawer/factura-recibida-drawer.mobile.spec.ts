import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FacturaRecibidaDrawerComponent } from './factura-recibida-drawer';
import { extraccionFalsa } from '../../../../../testing/facturas-recibidas';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

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

describe('FacturaRecibidaDrawerComponent — móvil', () => {
  for (const mobile of [false, true]) {
    describe(mobile ? 'móvil' : 'escritorio', () => {
      async function montar() {
        TestBed.resetTestingModule();
        mockViewport(mobile);
        await TestBed.configureTestingModule({ imports: [FacturaRecibidaDrawerComponent], providers: [extraccionFalsa()] }).compileComponents();
        const fixture = TestBed.createComponent(FacturaRecibidaDrawerComponent);
        fixture.componentRef.setInput('fechaHoy', '2026-04-05');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        return fixture;
      }

      it('es un diálogo modal con título y botones de pie táctiles', async () => {
        const f = await montar();
        const el = f.nativeElement as HTMLElement;
        const dlg = el.querySelector('[role="dialog"]')!;
        expect(dlg.getAttribute('aria-modal')).toBe('true');
        expect(dlg.querySelector('h2')?.textContent).toContain('Registrar factura recibida');
        for (const b of Array.from(el.querySelectorAll<HTMLButtonElement>('[data-overlay-footer] button'))) {
          expect(b.classList.contains('tap-target')).toBe(true);
        }
      });

      it('los campos usan los teclados adecuados y los inputs numéricos son inputmode decimal', async () => {
        const f = await montar();
        const el = f.nativeElement as HTMLElement;
        expect(el.querySelector('#fr-base-0')?.getAttribute('inputmode')).toBe('decimal');
        expect(el.querySelector('#fr-cuota-0')?.getAttribute('inputmode')).toBe('decimal');
        expect(el.querySelector('#fr-fecha-expedicion')?.getAttribute('type')).toBe('date');
      });

      it('sin violaciones AXE', async () => {
        const f = await montar();
        const v = await analizarA11y(f.nativeElement as HTMLElement);
        expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
      });
    });
  }
});
