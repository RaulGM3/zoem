import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Evento } from '../../../../interfaces/evento.interface';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';
import { esperarCalculo, montarDrawer, rellenarPlazoValido } from '../../../../../testing/plazo-drawer';

/** axe usa temporizadores reales: se restauran antes de auditar. */
async function auditar(raiz: Element) {
  vi.useRealTimers();
  const v = await analizarA11y(raiz);
  vi.useFakeTimers();
  return v;
}

describe('PlazoDrawerComponent — accesibilidad (axe)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('sin violaciones en el estado inicial', async () => {
    const { f } = await montarDrawer();
    const v = await auditar(f.nativeElement as HTMLElement);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });

  it('sin violaciones con vista previa, días inhábiles, advertencias y confirmación', async () => {
    const { f } = await montarDrawer({ advertencias: ['El caso no tiene partido judicial.', 'Agosto no computa en este plazo.'] });
    await rellenarPlazoValido(f);
    const c = document.body.querySelector<HTMLInputElement>('[data-confirmar]')!;
    c.checked = true;
    c.dispatchEvent(new Event('change', { bubbles: true }));
    f.detectChanges();
    const v = await auditar(f.nativeElement as HTMLElement);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });

  it('sin violaciones con error de cálculo y en modo revisión', async () => {
    const e = await montarDrawer({ errorPrevisualizar: new Error('Sin CA') });
    await rellenarPlazoValido(e.f);
    let v = await auditar(e.f.nativeElement as HTMLElement);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
    document.body.innerHTML = '';

    const plazo = {
      id: 'ev1', titulo: 'Plazo', fecha: '2026-10-21',
      origen: {
        tipo: 'plazo_procesal', casoId: 'caso1', capas: { ca: 'ca-madrid' },
        entrada: { fechaNotificacion: '2026-10-07', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil' },
        aceptacion: { diasInhabiles: [], excluidosPorUsuario: [], aceptadoPor: 'u1', aceptadoAt: '2026-10-07T10:00:00Z', vencimiento: '2026-10-21' },
        estadoPlazo: 'requiere_revision',
        revision: { vencimientoNuevo: '2026-10-22', seAdelanta: true, detectadoAt: '2026-10-08T00:00:00Z' },
      },
    } as unknown as Evento;
    const r = await montarDrawer({ plazoRevision: plazo });
    await esperarCalculo(r.f);
    v = await auditar(r.f.nativeElement as HTMLElement);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
