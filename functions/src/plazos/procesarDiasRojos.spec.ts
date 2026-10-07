import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapaAnio } from './dominio/dias-rojos';
import { procesarDiasRojos, type DepsDiasRojos } from './procesarDiasRojos';
import type { PlazoDoc } from './tipos';

const capa = (...fechas: string[]): CapaAnio => ({
  diasRojos: fechas.map((fecha) => ({ fecha, nombre: 'Pilar', ambito: 'local', estado: 'confirmado', origen: 'manual' })),
  descartados: [],
});

const plazo = (id: string, extra: Partial<PlazoDoc['origen']> = {}): PlazoDoc => ({
  id,
  cid: 'c1',
  titulo: `Vence plazo: P${id}`,
  origen: {
    casoId: `caso-${id}`,
    capas: { ca: 'ca-madrid', partido: 'pj-28-79' },
    entrada: { fechaNotificacion: '2026-10-05', cantidad: 5, unidad: 'dias', jurisdiccion: 'civil' },
    aceptacion: { excluidosPorUsuario: [], vencimiento: '2026-10-12' },
    estadoPlazo: 'vigente',
    ...extra,
  },
});

let deps: DepsDiasRojos;
let plazos: PlazoDoc[];
const capaNueva = capa('2026-10-12');

beforeEach(() => {
  plazos = [plazo('1')];
  deps = {
    plazosDeCapa: vi.fn(async () => plazos),
    cargarCapa: vi.fn(async (_cid, capaId) => (capaId === 'pj-28-79' ? capaNueva : undefined)),
    marcarRevision: vi.fn(async () => undefined),
    destinatarios: vi.fn(async () => ['u1', 'u2']),
    notify: vi.fn(async () => undefined),
    ahoraIso: () => '2026-10-07T10:00:00.000Z',
  };
});

const cambio = (over: Partial<Parameters<typeof procesarDiasRojos>[1]> = {}) => ({
  cid: 'c1', capaId: 'pj-28-79', anio: 2026, before: capa(), after: capaNueva, ...over,
});

describe('procesarDiasRojos', () => {
  it('no hace nada si no cambian los confirmados (ni consulta)', async () => {
    await procesarDiasRojos(deps, cambio({ before: capaNueva, after: capaNueva }));
    expect(deps.plazosDeCapa).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('marca requiere_revision y notifica a los destinatarios con ruta al caso', async () => {
    const r = await procesarDiasRojos(deps, cambio());
    expect(r).toEqual({ revisados: 1, marcados: 1 });
    expect(deps.marcarRevision).toHaveBeenCalledWith('c1', '1', {
      vencimientoNuevo: '2026-10-13', seAdelanta: false, detectadoAt: '2026-10-07T10:00:00.000Z',
    });
    expect(deps.notify).toHaveBeenCalledWith({
      companyId: 'c1',
      userIds: ['u1', 'u2'],
      tipo: 'plazo',
      titulo: 'El plazo «P1» requiere revisión',
      cuerpo: expect.stringContaining('13/10/2026'),
      route: '/casos/caso-1',
    });
  });

  it('título urgente cuando el vencimiento se adelanta (quitar un día rojo)', async () => {
    plazos = [plazo('1', { aceptacion: { excluidosPorUsuario: [], vencimiento: '2026-10-13' } })];
    deps.cargarCapa = vi.fn(async () => undefined);
    await procesarDiasRojos(deps, cambio({ before: capaNueva, after: capa() }));
    expect(deps.notify).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: '⚠ El plazo «P1» ahora vence ANTES: 12/10/2026' }),
    );
  });

  it('descarta plazos cuyo rango no toca el año modificado', async () => {
    await procesarDiasRojos(deps, cambio({ anio: 2020 }));
    expect(deps.marcarRevision).not.toHaveBeenCalled();
  });

  it('no escribe ni notifica si el plazo no cambia o ya estaba marcado igual (idempotente)', async () => {
    plazos = [plazo('1', {
      estadoPlazo: 'requiere_revision',
      revision: { vencimientoNuevo: '2026-10-13', seAdelanta: false, detectadoAt: 'antes' },
    })];
    const r = await procesarDiasRojos(deps, cambio());
    expect(r.marcados).toBe(0);
    expect(deps.marcarRevision).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('un plazo que falla no impide procesar los demás', async () => {
    plazos = [plazo('1', { entrada: { fechaNotificacion: '2026-10-05', cantidad: 0, unidad: 'dias', jurisdiccion: 'civil' } }), plazo('2')];
    const r = await procesarDiasRojos(deps, cambio());
    expect(r).toEqual({ revisados: 2, marcados: 1 });
    expect(deps.marcarRevision).toHaveBeenCalledTimes(1);
  });

  it('sin destinatarios marca igualmente pero no notifica', async () => {
    deps.destinatarios = vi.fn(async () => []);
    await procesarDiasRojos(deps, cambio());
    expect(deps.marcarRevision).toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('carga cada capa/año una sola vez aunque haya varios plazos', async () => {
    plazos = [plazo('1'), plazo('2')];
    await procesarDiasRojos(deps, cambio());
    const llamadas = (deps.cargarCapa as ReturnType<typeof vi.fn>).mock.calls.map((c) => `${c[1]}/${c[2]}`);
    expect(new Set(llamadas).size).toBe(llamadas.length);
  });
});
