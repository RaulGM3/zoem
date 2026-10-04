import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturaDrawerComponent } from './factura-drawer';
import type { InvoiceLinea } from '../../../../core/services/invoice.service';
import type { Caso } from '../../../../interfaces';
import type { Contact } from '../../../../interfaces/contact.interface';
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

const LINEA: InvoiceLinea = { concepto: 'Honorarios', cantidad: 1, precioUnitario: 100, base: 100, aplicaIva: true };
const ANA = { id: 'c-1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'Pérez', nifType: 'dni', nif: '12345678Z' } as Contact;

describe('FacturaDrawerComponent — overlay-shell y móvil', () => {
  let fixture: ComponentFixture<FacturaDrawerComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    await TestBed.configureTestingModule({ imports: [FacturaDrawerComponent] }).compileComponents();
    fixture = TestBed.createComponent(FacturaDrawerComponent);
    fixture.componentRef.setInput('caso', { id: 'k', titulo: 'Caso Uno' } as unknown as Caso);
    fixture.componentRef.setInput('initialLineas', [LINEA]);
    fixture.componentRef.setInput('initialCliente', { nombre: 'Cliente', tipoId: 'nif' });
    fixture.componentRef.setInput('contactos', [ANA]);
    fixture.componentRef.setInput('permitirBuscarContacto', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.resetTestingModule());

  for (const mobile of [false, true]) {
    describe(mobile ? 'móvil' : 'escritorio', () => {
      it('es un diálogo (overlay-shell) con el título y el nombre del caso', async () => {
        await montar(mobile);
        const dlg = el().querySelector('app-overlay-shell [role="dialog"]')!;
        expect(dlg).not.toBeNull();
        expect(dlg.getAttribute('aria-modal')).toBe('true');
        expect(dlg.querySelector('h2')?.textContent).toContain('Generar factura');
        expect(dlg.textContent).toContain('Caso Uno');
      });

      it('Escape cierra el drawer', async () => {
        await montar(mobile);
        let cierres = 0;
        fixture.componentInstance.closed.subscribe(() => cierres++);
        el().querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(cierres).toBe(1);
      });

      it('Escape dentro del buscador con la lista abierta solo cierra la lista', async () => {
        await montar(mobile);
        let cierres = 0;
        fixture.componentInstance.closed.subscribe(() => cierres++);
        const input = el().querySelector<HTMLInputElement>('#cliente-buscar')!;
        input.value = 'Ana';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(cierres).toBe(0);
      });

      it('los botones Cancelar y Generar factura están en el footer del shell', async () => {
        await montar(mobile);
        const footer = el().querySelector('[data-overlay-footer]')!;
        const textos = Array.from(footer.querySelectorAll('button')).map((b) => b.textContent?.trim());
        expect(textos).toEqual(['Cancelar', 'Generar factura']);
        let cierres = 0;
        fixture.componentInstance.closed.subscribe(() => cierres++);
        footer.querySelector<HTMLButtonElement>('button')!.click();
        expect(cierres).toBe(1);
      });

      it('el botón de cerrar del shell cierra', async () => {
        await montar(mobile);
        let cierres = 0;
        fixture.componentInstance.closed.subscribe(() => cierres++);
        el().querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click();
        expect(cierres).toBe(1);
      });
    });
  }

  it('rejillas de 2 columnas se apilan en móvil (grid-cols-1 sm:grid-cols-2)', async () => {
    await montar(true);
    for (const id of ['cliente-tipoId', 'issueDate']) {
      const grid = el().querySelector(`#${id}`)!.closest('.grid')!;
      expect(grid.classList.contains('grid-cols-1'), id).toBe(true);
      expect(grid.classList.contains('sm:grid-cols-2'), id).toBe(true);
      expect(grid.classList.contains('grid-cols-2'), id).toBe(false);
    }
  });

  it('línea: cantidad y precio lado a lado, subtotal en su propia fila en móvil', async () => {
    await montar(true);
    const cantidad = el().querySelector('input[aria-label="Cantidad línea 1"]')!;
    const fila = cantidad.closest('.grid')!;
    expect(fila.classList.contains('grid-cols-2')).toBe(true);
    expect(fila.classList.contains('sm:grid-cols-[1fr_1fr_auto]')).toBe(true);
    const subtotal = fila.lastElementChild!;
    expect(subtotal.classList.contains('col-span-2')).toBe(true);
    expect(subtotal.classList.contains('sm:col-span-1')).toBe(true);
    expect(subtotal.textContent).toContain('100.00');
  });

  describe('autocompletado de cliente en móvil', () => {
    afterEach(() => {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    });

    it('al enfocar el buscador hace scrollIntoView centrado', async () => {
      const spy = vi.fn();
      (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView = spy;
      await montar(true);
      el().querySelector<HTMLInputElement>('#cliente-buscar')!.dispatchEvent(new Event('focus'));
      expect(spy).toHaveBeenCalledWith({ block: 'center' });
    });

    it('sin scrollIntoView (jsdom) no lanza', async () => {
      await montar(true);
      expect(() => el().querySelector<HTMLInputElement>('#cliente-buscar')!.dispatchEvent(new Event('focus'))).not.toThrow();
    });

    it('en escritorio no hace scroll', async () => {
      const spy = vi.fn();
      (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView = spy;
      await montar(false);
      el().querySelector<HTMLInputElement>('#cliente-buscar')!.dispatchEvent(new Event('focus'));
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
