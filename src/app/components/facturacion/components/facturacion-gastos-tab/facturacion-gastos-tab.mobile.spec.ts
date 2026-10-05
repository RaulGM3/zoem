import { describe, it, expect, beforeEach } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { FacturacionGastosTabComponent } from './facturacion-gastos-tab';
import { crearFake, montarTab, type FakeSvc } from '../../../../../testing/facturas-recibidas';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

describe('FacturacionGastosTabComponent — móvil', () => {
  let fake: FakeSvc;
  let fixture: ComponentFixture<FacturacionGastosTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(sel: string): T => el().querySelector<T>(sel)!;

  beforeEach(async () => {
    fake = crearFake();
    ({ fixture } = await montarTab(fake, true));
  });

  it('muestra tarjetas (lista) y no tabla', () => {
    expect(el().querySelector('table')).toBeNull();
    expect(el().querySelector('ul[role="list"]')).not.toBeNull();
    const ids = Array.from(el().querySelectorAll('article[data-factura-fila]')).map((a) => a.getAttribute('data-factura-fila'));
    expect(ids.sort()).toEqual(['A', 'B', 'D']);
  });

  it('la tarjeta muestra emisor, número, total y estado; la anulada va tachada', () => {
    const a = q('article[data-factura-fila="A"]');
    expect(a.textContent).toContain('Proveedor SL');
    expect(a.textContent).toContain('F-A');
    expect(a.textContent).toMatch(/121[.,]00/);
    expect(a.textContent).toContain('Registrada');
    expect(q('article[data-factura-fila="D"]').textContent).toContain('Anulada');
  });

  it('la acción Anular está en el menú ⋯ y solo en las registradas', async () => {
    expect(q('article[data-factura-fila="D"]').querySelector('app-action-menu')).toBeNull();
    q<HTMLButtonElement>('article[data-factura-fila="A"] app-action-menu button').click();
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-action-id="anular"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fake.anular).toHaveBeenCalledWith('A');
  });

  it('el botón de registrar es un objetivo táctil y abre el drawer a pantalla completa (diálogo)', async () => {
    const btn = q<HTMLButtonElement>('[data-registrar]');
    expect(btn.classList.contains('tap-target')).toBe(true);
    btn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const dlg = q('[role="dialog"]');
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.querySelector('h2')?.textContent).toContain('factura recibida');
  });

  it('sin violaciones AXE en móvil', async () => {
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
