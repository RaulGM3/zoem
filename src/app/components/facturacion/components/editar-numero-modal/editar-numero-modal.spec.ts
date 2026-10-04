import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { EditarNumeroModalComponent } from './editar-numero-modal';
import type { Invoice } from '../../../../core/services/invoice.service';
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

const FACTURA: Invoice = {
  id: 'f-1', companyId: 'co', invoiceNumber: 'F-2026-0001', amount: 100, vat: 21, total: 121,
  status: 'pendiente', issueDate: '2026-10-01', dueDate: '2026-10-31',
};

describe('EditarNumeroModalComponent', () => {
  let fixture: ComponentFixture<EditarNumeroModalComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const footer = (): HTMLButtonElement[] => Array.from(el().querySelectorAll<HTMLButtonElement>('[data-overlay-footer] button'));

  async function montar(mobile = false): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [EditarNumeroModalComponent] });
    fixture = TestBed.createComponent(EditarNumeroModalComponent);
    fixture.componentRef.setInput('invoice', FACTURA);
    fixture.componentRef.setInput('existingNumbers', ['F-2026-0002']);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function escribir(valor: string, aceptar = true): Promise<void> {
    const input = el().querySelector<HTMLInputElement>('#nuevo-numero')!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    if (aceptar) {
      const chk = el().querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      chk.checked = true;
      chk.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  for (const mobile of [false, true]) {
    describe(mobile ? 'móvil (bottom sheet)' : 'escritorio', () => {
      it('diálogo titulado "Cambiar número de factura" con el número precargado', async () => {
        await montar(mobile);
        const dlg = el().querySelector('[role="dialog"]')!;
        expect(dlg.querySelector('h2')?.textContent).toContain('Cambiar número de factura');
        expect(el().querySelector<HTMLInputElement>('#nuevo-numero')!.value).toBe('F-2026-0001');
      });

      it('Escape cierra una sola vez', async () => {
        await montar(mobile);
        let cierres = 0;
        fixture.componentInstance.closed.subscribe(() => cierres++);
        el().querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(cierres).toBe(1);
      });

      it('footer: Cancelar cierra y Cambiar número solo se habilita con número nuevo válido y aceptación', async () => {
        await montar(mobile);
        const [cancelar, cambiar] = footer();
        expect(cancelar.textContent?.trim()).toBe('Cancelar');
        expect(cambiar.textContent?.trim()).toBe('Cambiar número');
        expect(cambiar.disabled).toBe(true);
        await escribir('F-2026-0099');
        expect(footer()[1].disabled).toBe(false);
        await escribir('F-2026-0002');
        expect(footer()[1].disabled).toBe(true);
        expect(el().querySelector('#numero-error')?.textContent).toContain('en uso');
        let cierres = 0;
        fixture.componentInstance.closed.subscribe(() => cierres++);
        cancelar.click();
        expect(cierres).toBe(1);
      });

      it('el botón del footer envía el formulario y emite el nuevo número', async () => {
        await montar(mobile);
        const out: string[] = [];
        fixture.componentInstance.confirmed.subscribe((n) => out.push(n));
        await escribir('F-2026-0099');
        footer()[1].click();
        expect(out).toEqual(['F-2026-0099']);
      });

      it('sin violaciones axe', async () => {
        await montar(mobile);
        const v = await analizarA11y(el());
        expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
      });
    });
  }
});
