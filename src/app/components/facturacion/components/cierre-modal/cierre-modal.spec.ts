import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CierreModalComponent } from './cierre-modal';
import type { Caso } from '../../../../interfaces';
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

describe('CierreModalComponent', () => {
  let fixture: ComponentFixture<CierreModalComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const botones = (): HTMLButtonElement[] => Array.from(el().querySelectorAll<HTMLButtonElement>('[data-overlay-footer] button'));

  async function montar(mobile = false, over: { puedeCerrar?: boolean; saving?: boolean } = {}): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [CierreModalComponent] });
    fixture = TestBed.createComponent(CierreModalComponent);
    fixture.componentRef.setInput('caso', { id: 'k', titulo: 'Caso X' } as unknown as Caso);
    fixture.componentRef.setInput('movimientosOk', false);
    fixture.componentRef.setInput('bancoOk', false);
    fixture.componentRef.setInput('puedeCerrar', over.puedeCerrar ?? true);
    fixture.componentRef.setInput('saving', over.saving ?? false);
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  for (const mobile of [false, true]) {
    describe(mobile ? 'móvil (bottom sheet)' : 'escritorio', () => {
      it('es un diálogo con el título "Cerrar caso" y el nombre del caso', async () => {
        await montar(mobile);
        const dlg = el().querySelector('[role="dialog"]')!;
        expect(dlg.getAttribute('aria-modal')).toBe('true');
        expect(dlg.querySelector('h2')?.textContent).toContain('Cerrar caso');
        expect(dlg.textContent).toContain('Caso X');
      });

      it('Escape cierra', async () => {
        await montar(mobile);
        let cierres = 0;
        fixture.componentInstance.closed.subscribe(() => cierres++);
        el().querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(cierres).toBe(1);
      });

      it('el footer tiene Cancelar (cierra) y Confirmar cierre (confirma)', async () => {
        await montar(mobile);
        const out: string[] = [];
        fixture.componentInstance.closed.subscribe(() => out.push('closed'));
        fixture.componentInstance.confirmed.subscribe(() => out.push('confirmed'));
        const [cancelar, confirmar] = botones();
        expect(cancelar.textContent?.trim()).toBe('Cancelar');
        expect(confirmar.textContent?.trim()).toBe('Confirmar cierre');
        cancelar.click();
        confirmar.click();
        expect(out).toEqual(['closed', 'confirmed']);
      });

      it('Confirmar está deshabilitado si no se puede cerrar o se está guardando', async () => {
        await montar(mobile, { puedeCerrar: false });
        expect(botones()[1].disabled).toBe(true);
        await montar(mobile, { saving: true });
        expect(botones()[1].disabled).toBe(true);
        expect(botones()[1].textContent).toContain('Cerrando…');
      });

      it('los checkboxes emiten sus cambios', async () => {
        await montar(mobile);
        const out: string[] = [];
        fixture.componentInstance.movimientosOkChange.subscribe((v) => out.push(`m:${v}`));
        fixture.componentInstance.bancoOkChange.subscribe((v) => out.push(`b:${v}`));
        const [m, b] = Array.from(el().querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        m.checked = true; m.dispatchEvent(new Event('change'));
        b.checked = true; b.dispatchEvent(new Event('change'));
        expect(out).toEqual(['m:true', 'b:true']);
      });

      it('sin violaciones axe', async () => {
        await montar(mobile);
        const v = await analizarA11y(el());
        expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
      });
    });
  }
});
