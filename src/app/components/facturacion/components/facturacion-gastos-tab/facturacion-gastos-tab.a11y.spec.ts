import { describe, it, expect } from 'vitest';
import { crearFake, factura, FACTURAS, montarTab } from '../../../../../testing/facturas-recibidas';
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
  it.each([false, true])('sin violaciones con insignias de QR, enlace de error y acción validar (móvil=%s)', async (movil) => {
    const qr = { url: 'https://aeat.example/qr', nif: 'B12345674', numserie: 'F-Q', fecha: '02-04-2026', importe: 121 };
    const lista = [
      ...FACTURAS,
      factura({ id: 'P', numeroRecepcion: 10, qr, qrValidacion: { estado: 'pendiente' } }),
      factura({ id: 'E', numeroRecepcion: 11, qr, qrValidacion: { estado: 'encontrada' } }),
      factura({ id: 'N', numeroRecepcion: 12, qr, qrValidacion: { estado: 'no_encontrada' } }),
      factura({ id: 'V', numeroRecepcion: 13, qr, qrValidacion: { estado: 'no_verificable' } }),
      factura({ id: 'X', numeroRecepcion: 14, qr, qrValidacion: { estado: 'error', mensaje: 'Fallo de red', urlConsulta: 'https://aeat.example/v' } }),
    ];
    const { fixture } = await montarTab(crearFake(lista), movil);
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-qr-enlace]')).not.toBeNull();
    const v = await analizarA11y(raiz);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
