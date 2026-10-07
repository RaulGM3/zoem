import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Evento } from '../../../../interfaces/evento.interface';
import { esperarCalculo, escribirEn, FESTIVO, montarDrawer, rellenarPlazoValido } from '../../../../../testing/plazo-drawer';

const q = <T extends HTMLElement>(sel: string): T | null => document.body.querySelector<T>(sel);
const guardarBtn = (): HTMLButtonElement => q<HTMLButtonElement>('[data-guardar]')!;
const confirmar = (f: { detectChanges: () => void }, valor = true): void => {
  const c = q<HTMLInputElement>('[data-confirmar]')!;
  c.checked = valor;
  c.dispatchEvent(new Event('change', { bubbles: true }));
  f.detectChanges();
};

const plazoEnRevision = {
  id: 'ev1',
  titulo: 'Vence plazo: Contestación',
  fecha: '2026-10-21',
  origen: {
    tipo: 'plazo_procesal', casoId: 'caso1', capas: { ca: 'ca-madrid' },
    entrada: { fechaNotificacion: '2026-10-07', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil' },
    aceptacion: { diasInhabiles: [], excluidosPorUsuario: [], aceptadoPor: 'u1', aceptadoAt: '2026-10-07T10:00:00Z', vencimiento: '2026-10-21' },
    estadoPlazo: 'requiere_revision',
    revision: { vencimientoNuevo: '2026-10-22', seAdelanta: false, detectadoAt: '2026-10-08T00:00:00Z' },
  },
} as unknown as Evento;

describe('PlazoDrawerComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('muestra el aviso BETA fijo y parte con Guardar deshabilitado y la jurisdicción del caso', async () => {
    const { f } = await montarDrawer();
    expect(q('[data-beta-aviso]')?.textContent).toContain('Función en pruebas. Cálculo orientativo; la responsabilidad del cómputo es del profesional.');
    expect(guardarBtn().disabled).toBe(true);
    expect(q<HTMLSelectElement>('#plazo-jurisdiccion')!.value).toBe('civil');
    expect(f).toBeTruthy();
  });

  it('elegir un tipo de plazo precarga cantidad y unidad; las opciones se filtran por jurisdicción', async () => {
    const { f } = await montarDrawer();
    const opciones = Array.from(q<HTMLSelectElement>('#plazo-tipo')!.options).map((o) => o.value);
    expect(opciones).toContain('contestacion-verbal');
    expect(opciones).not.toContain('recurso-contencioso');
    escribirEn(f, '#plazo-tipo', 'contestacion-ordinario', 'change');
    expect(q<HTMLInputElement>('#plazo-cantidad')!.value).toBe('20');
    escribirEn(f, '#plazo-jurisdiccion', 'contencioso', 'change');
    expect(q<HTMLSelectElement>('#plazo-tipo')!.value).toBe('');
    escribirEn(f, '#plazo-tipo', 'recurso-contencioso', 'change');
    expect(q<HTMLInputElement>('#plazo-cantidad')!.value).toBe('2');
    expect(q<HTMLSelectElement>('#plazo-unidad')!.value).toBe('meses');
  });

  it('vista previa en vivo: vencimiento y día de gracia dentro de una región aria-live', async () => {
    const { f, mocks } = await montarDrawer();
    await rellenarPlazoValido(f);
    expect(mocks.previsualizar).toHaveBeenCalledTimes(1);
    const live = q('[data-preview]')!;
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.querySelector('[data-vencimiento]')?.textContent).toBe('22/10/2026');
    expect(live.textContent).toContain('23/10/2026');
    expect(live.textContent).toContain('15:00');
  });

  it('Guardar exige confirmar la revisión; el texto cuenta los días inhábiles', async () => {
    const { f } = await montarDrawer();
    await rellenarPlazoValido(f);
    expect(q('[data-confirmar]')!.closest('label')?.textContent).toContain('He revisado los 1 días inhábiles y el vencimiento resultante');
    expect(guardarBtn().disabled).toBe(true);
    confirmar(f);
    expect(guardarBtn().disabled).toBe(false);
  });

  it('desmarcar un día recalcula, lo deja listado como hábil y resetea la confirmación', async () => {
    const { f, mocks } = await montarDrawer();
    await rellenarPlazoValido(f);
    confirmar(f);
    const dia = q<HTMLInputElement>('[data-dia]')!;
    expect(dia.closest('li')?.textContent).toContain('12/10/2026');
    expect(dia.closest('li')?.textContent).toContain(FESTIVO.etiqueta);
    expect(dia.checked).toBe(true);
    expect(dia.closest('li')?.querySelector('a')?.getAttribute('href')).toContain('boe.es');
    dia.checked = false;
    dia.dispatchEvent(new Event('change', { bubbles: true }));
    f.detectChanges();
    expect(q<HTMLInputElement>('[data-confirmar]')!.checked).toBe(false);
    expect(guardarBtn().disabled).toBe(true);
    await esperarCalculo(f);
    expect(mocks.previsualizar.mock.calls.at(-1)![0].excluidosPorUsuario).toEqual(['2026-10-12']);
    expect(q('[data-vencimiento]')?.textContent).toBe('21/10/2026');
    const sigue = q<HTMLInputElement>('[data-dia]')!;
    expect(sigue.checked).toBe(false);
    expect(sigue.closest('li')?.textContent).toContain('cuenta como hábil');
    expect(q<HTMLInputElement>('[data-confirmar]')!.checked).toBe(false);
  });

  it('cambiar la fecha invalida los días revisados', async () => {
    const { f, mocks } = await montarDrawer();
    await rellenarPlazoValido(f);
    const dia = q<HTMLInputElement>('[data-dia]')!;
    dia.checked = false;
    dia.dispatchEvent(new Event('change', { bubbles: true }));
    f.detectChanges();
    await esperarCalculo(f);
    escribirEn(f, '#plazo-fecha', '2026-10-08');
    await esperarCalculo(f);
    expect(mocks.previsualizar.mock.calls.at(-1)![0].excluidosPorUsuario).toEqual([]);
  });

  it('muestra las advertencias como alertas y mueve el foco a la primera, una sola vez', async () => {
    const { f } = await montarDrawer({ advertencias: ['Sin partido judicial', 'Agosto no computa'] });
    await rellenarPlazoValido(f);
    await vi.advanceTimersByTimeAsync(50);
    f.detectChanges();
    const alertas = document.body.querySelectorAll('[data-advertencia]');
    expect(alertas).toHaveLength(2);
    expect(alertas[0].getAttribute('role')).toBe('alert');
    expect(document.activeElement).toBe(alertas[0]);
    (document.activeElement as HTMLElement).blur();
    escribirEn(f, '#plazo-cantidad', '11');
    await esperarCalculo(f);
    expect(document.activeElement).not.toBe(document.body.querySelector('[data-advertencia]'));
  });

  it('Guardar llama a PlazosService.guardar con etiqueta, capas, título del caso y excluidos', async () => {
    const { f, mocks } = await montarDrawer();
    const cerrado = vi.fn();
    f.componentInstance.closed.subscribe(cerrado);
    escribirEn(f, '#plazo-tipo', 'contestacion-verbal', 'change');
    escribirEn(f, '#plazo-fecha', '2026-10-07');
    await esperarCalculo(f);
    confirmar(f);
    guardarBtn().click();
    await vi.advanceTimersByTimeAsync(0);
    f.detectChanges();
    expect(mocks.guardar).toHaveBeenCalledTimes(1);
    const [casoId, entrada, resultado, excluidos] = mocks.guardar.mock.calls[0];
    expect(casoId).toBe('caso1');
    expect(entrada).toMatchObject({
      fechaNotificacion: '2026-10-07', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil', tipoPlazoId: 'contestacion-verbal',
      etiqueta: 'Contestación a la demanda (juicio verbal)', casoTitulo: 'Pérez vs. Gómez', capas: { ca: 'ca-madrid', partido: 'pj-28-4' },
    });
    expect('advertencias' in entrada.capas).toBe(false);
    expect(resultado.vencimiento).toBe('2026-10-22');
    expect(excluidos).toEqual([]);
    expect(cerrado).toHaveBeenCalled();
  });

  it('error de cálculo: se muestra y Guardar sigue deshabilitado', async () => {
    const { f } = await montarDrawer({ errorPrevisualizar: new Error('La empresa no tiene comunidad autónoma configurada') });
    await rellenarPlazoValido(f);
    expect(q('[data-preview]')?.textContent).toContain('comunidad autónoma');
    expect(guardarBtn().disabled).toBe(true);
  });

  it('sin permiso de edición no se puede confirmar ni guardar', async () => {
    const { f, mocks } = await montarDrawer({ canEdit: false });
    expect(q<HTMLInputElement>('#plazo-fecha')!.disabled).toBe(true);
    expect(guardarBtn().disabled).toBe(true);
    await f.whenStable();
    expect(mocks.guardar).not.toHaveBeenCalled();
  });

  describe('modo revisión', () => {
    it('precarga el cálculo, muestra "vencía el X, ahora el Y" y acepta con aceptarRevision', async () => {
      const { f, mocks } = await montarDrawer({ plazoRevision: plazoEnRevision });
      await esperarCalculo(f);
      expect(q('[data-banner-revision]')?.textContent).toMatch(/vencía el\s+21\/10\/2026,\s+ahora el\s+22\/10\/2026/);
      expect(q<HTMLInputElement>('#plazo-fecha')!.value).toBe('2026-10-07');
      expect(q<HTMLInputElement>('#plazo-fecha')!.disabled).toBe(true);
      confirmar(f);
      guardarBtn().click();
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.aceptarRevision).toHaveBeenCalledTimes(1);
      const [id, resultado, excluidos] = mocks.aceptarRevision.mock.calls[0];
      expect(id).toBe('ev1');
      expect(resultado.vencimiento).toBe('2026-10-22');
      expect(excluidos).toEqual([]);
      expect(mocks.guardar).not.toHaveBeenCalled();
    });
  });
});
