import { describe, expect, it } from 'vitest';
import type { CapaAnio } from './dominio/dias-rojos';
import { aniosDelPlazo, cambioConfirmados, revisarPlazo, textoRevision, type OrigenPlazoData } from './revision';

const dia = (fecha: string, nombre = 'F', estado: 'confirmado' | 'propuesto' = 'confirmado') => ({
  fecha, nombre, ambito: 'local' as const, estado, origen: 'manual' as const,
});
const capa = (...dias: ReturnType<typeof dia>[]): CapaAnio => ({ diasRojos: dias, descartados: [] });

describe('cambioConfirmados', () => {
  it('false si solo cambian propuestas o la marca de búsqueda', () => {
    const antes = capa(dia('2026-10-12', 'Pilar'));
    const despues: CapaAnio = {
      ...capa(dia('2026-10-12', 'Pilar'), dia('2026-11-01', 'X', 'propuesto')),
      ultimaBusquedaIa: { ejecutadaAt: 'a', ejecutadaPor: 'u', propuestos: 1 },
    };
    expect(cambioConfirmados(antes, despues)).toBe(false);
  });
  it('true si se confirma un día, se quita o cambia el nombre', () => {
    expect(cambioConfirmados(capa(), capa(dia('2026-10-12')))).toBe(true);
    expect(cambioConfirmados(capa(dia('2026-10-12')), capa())).toBe(true);
    expect(cambioConfirmados(capa(dia('2026-10-12', 'A')), capa(dia('2026-10-12', 'B')))).toBe(true);
  });
  it('el orden no importa y undefined equivale a vacío', () => {
    expect(cambioConfirmados(capa(dia('2026-10-12'), dia('2026-10-13')), capa(dia('2026-10-13'), dia('2026-10-12')))).toBe(false);
    expect(cambioConfirmados(undefined, capa())).toBe(false);
    expect(cambioConfirmados(undefined, capa(dia('2026-10-12')))).toBe(true);
  });
  it('propuesto -> confirmado cuenta como cambio', () => {
    expect(cambioConfirmados(capa(dia('2026-10-12', 'F', 'propuesto')), capa(dia('2026-10-12')))).toBe(true);
  });
});

const origen = (extra: Partial<OrigenPlazoData> = {}): OrigenPlazoData => ({
  casoId: 'c1',
  capas: { ca: 'ca-madrid', partido: 'pj-28-79' },
  entrada: { fechaNotificacion: '2026-10-05', cantidad: 5, unidad: 'dias', jurisdiccion: 'civil' },
  // 6,7(sab/dom) -> 6 lun... : 06,07,08,09 hábiles, 12 es festivo en aceptación? ver tests
  aceptacion: { excluidosPorUsuario: [], vencimiento: '2026-10-13' },
  estadoPlazo: 'vigente',
  ...extra,
});

describe('aniosDelPlazo', () => {
  it('desde la notificación hasta el año siguiente al vencimiento', () => {
    expect(aniosDelPlazo(origen({ entrada: { ...origen().entrada, fechaNotificacion: '2026-12-20' }, aceptacion: { excluidosPorUsuario: [], vencimiento: '2027-01-12' } })))
      .toEqual([2026, 2027, 2028]);
  });
});

describe('revisarPlazo', () => {
  // Notif lun 2026-10-05, 5 hábiles: 6,7,8,9,(12 festivo nacional si confirmado) -> sin festivo vence 2026-10-12 (lun).
  const base = origen({ aceptacion: { excluidosPorUsuario: [], vencimiento: '2026-10-12' } });
  const sinCapas = () => undefined;

  it('null si el cálculo no cambia', () => {
    expect(revisarPlazo(base, sinCapas, 'ahora')).toBeNull();
  });

  it('un día rojo confirmado nuevo retrasa el vencimiento: no se adelanta', () => {
    const obtener = (capaId: string, anio: number) =>
      capaId === 'pj-28-79' && anio === 2026 ? capa(dia('2026-10-12', 'Pilar')) : undefined;
    expect(revisarPlazo(base, obtener, 'T')).toEqual({ vencimientoNuevo: '2026-10-13', seAdelanta: false, detectadoAt: 'T' });
  });

  it('se adelanta si el plazo aceptado contaba un festivo que ya no existe', () => {
    const aceptado = origen({ aceptacion: { excluidosPorUsuario: [], vencimiento: '2026-10-13' } });
    expect(revisarPlazo(aceptado, sinCapas, 'T')).toEqual({ vencimientoNuevo: '2026-10-12', seAdelanta: true, detectadoAt: 'T' });
  });

  it('respeta excluidosPorUsuario (día rojo que el usuario desmarcó no cambia nada)', () => {
    const obtener = (capaId: string) => (capaId === 'ca-madrid' ? capa(dia('2026-10-12', 'Pilar')) : undefined);
    const conExclusion = origen({ aceptacion: { excluidosPorUsuario: ['2026-10-12'], vencimiento: '2026-10-12' } });
    expect(revisarPlazo(conExclusion, obtener, 'T')).toBeNull();
  });

  it('ignora propuestas: solo cuentan los confirmados', () => {
    const obtener = () => capa(dia('2026-10-12', 'Pilar', 'propuesto'));
    expect(revisarPlazo(base, obtener, 'T')).toBeNull();
  });

  it('idempotente: ya en revisión con el mismo vencimientoNuevo no vuelve a marcar', () => {
    const obtener = () => capa(dia('2026-10-12', 'Pilar'));
    const yaMarcado = origen({
      aceptacion: base.aceptacion,
      estadoPlazo: 'requiere_revision',
      revision: { vencimientoNuevo: '2026-10-13', seAdelanta: false, detectadoAt: 'antes' },
    });
    expect(revisarPlazo(yaMarcado, obtener, 'T')).toBeNull();
  });

  it('en revisión con otro vencimientoNuevo sí actualiza', () => {
    const obtener = () => capa(dia('2026-10-12', 'Pilar'));
    const yaMarcado = origen({
      aceptacion: base.aceptacion,
      estadoPlazo: 'requiere_revision',
      revision: { vencimientoNuevo: '2026-10-14', seAdelanta: false, detectadoAt: 'antes' },
    });
    expect(revisarPlazo(yaMarcado, obtener, 'T')?.vencimientoNuevo).toBe('2026-10-13');
  });

  it('plazo sin capa de partido compone solo la autonómica', () => {
    const sinPartido = origen({ capas: { ca: 'ca-madrid' }, aceptacion: base.aceptacion });
    const obtener = (capaId: string) => (capaId === 'ca-madrid' ? capa(dia('2026-10-12', 'Pilar')) : undefined);
    expect(revisarPlazo(sinPartido, obtener, 'T')?.vencimientoNuevo).toBe('2026-10-13');
  });
});

describe('textoRevision', () => {
  it('adelanta: urgente y con fecha dd/mm/yyyy, sin prefijo "Vence plazo:"', () => {
    expect(textoRevision('Vence plazo: Contestación · Caso Pérez', { vencimientoNuevo: '2026-10-12', seAdelanta: true, detectadoAt: 't' }))
      .toEqual({
        titulo: '⚠ El plazo «Contestación · Caso Pérez» ahora vence ANTES: 12/10/2026',
        cuerpo: 'Revisa el cálculo: un cambio en los días inhábiles adelanta el vencimiento.',
      });
  });
  it('no adelanta: requiere revisión', () => {
    const t = textoRevision('Contestación', { vencimientoNuevo: '2026-10-13', seAdelanta: false, detectadoAt: 't' });
    expect(t.titulo).toBe('El plazo «Contestación» requiere revisión');
    expect(t.cuerpo).toContain('13/10/2026');
  });
});
