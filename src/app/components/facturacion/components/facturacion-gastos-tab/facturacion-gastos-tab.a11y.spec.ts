import { describe, it, expect } from 'vitest';
import { crearFake, montarTab } from '../../../../../testing/facturas-recibidas';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

describe('FacturacionGastosTabComponent — accesibilidad (axe)', () => {
  it('sin violaciones con la tabla de escritorio y los KPIs', async () => {
    const { fixture } = await montarTab(crearFake());
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('table')).not.toBeNull();
    const v = await analizarA11y(raiz);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });

  it('sin violaciones con el estado vacío', async () => {
    const { fixture } = await montarTab(crearFake([]));
    const v = await analizarA11y(fixture.nativeElement as HTMLElement);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });

  it('sin violaciones con el drawer de registro abierto', async () => {
    const { fixture } = await montarTab(crearFake());
    const raiz = fixture.nativeElement as HTMLElement;
    raiz.querySelector<HTMLButtonElement>('[data-registrar]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(raiz.querySelector('[role="dialog"]')).not.toBeNull();
    const v = await analizarA11y(raiz);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
