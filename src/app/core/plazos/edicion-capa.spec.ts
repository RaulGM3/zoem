import { describe, expect, it } from 'vitest';
import { anadirDiaManual, aniosAfectados, confirmarDia, confirmarTodos, quitarDia, resolverCapas } from './edicion-capa';
import type { CapaAnio, DiaRojo } from './dias-rojos';

const dia = (fecha: string, extra: Partial<DiaRojo> = {}): DiaRojo => ({
  fecha, nombre: `F ${fecha}`, ambito: 'nacional', estado: 'propuesto', origen: 'ia', ...extra,
});
const capa = (diasRojos: DiaRojo[], descartados: string[] = []): CapaAnio => ({ diasRojos, descartados });

describe('quitarDia', () => {
  it('quita el día y lo añade a descartados sin duplicar', () => {
    const r = quitarDia(capa([dia('2026-10-12'), dia('2026-12-08')], ['2026-12-08']), '2026-12-08');
    expect(r.diasRojos.map((d) => d.fecha)).toEqual(['2026-10-12']);
    expect(r.descartados).toEqual(['2026-12-08']);
    expect(quitarDia(r, '2026-10-12').descartados).toEqual(['2026-12-08', '2026-10-12']);
  });
  it('no muta la capa original', () => {
    const c = capa([dia('2026-10-12')]);
    quitarDia(c, '2026-10-12');
    expect(c.diasRojos).toHaveLength(1);
    expect(c.descartados).toEqual([]);
  });
});

describe('confirmarDia / confirmarTodos', () => {
  it('confirma un día dejando constancia de quién y cuándo', () => {
    const r = confirmarDia(capa([dia('2026-10-12')]), '2026-10-12', 'u1', '2026-10-07T10:00:00.000Z');
    expect(r.diasRojos[0]).toMatchObject({ estado: 'confirmado', confirmadoPor: 'u1', confirmadoAt: '2026-10-07T10:00:00.000Z' });
  });
  it('confirmar un día ya confirmado conserva la confirmación original', () => {
    const c = capa([dia('2026-10-12', { estado: 'confirmado', confirmadoPor: 'a', confirmadoAt: 'x' })]);
    expect(confirmarDia(c, '2026-10-12', 'b', 'y').diasRojos[0]).toMatchObject({ confirmadoPor: 'a', confirmadoAt: 'x' });
  });
  it('confirmarTodos solo toca los propuestos', () => {
    const c = capa([dia('2026-10-12'), dia('2026-12-08', { estado: 'confirmado', confirmadoPor: 'a', confirmadoAt: 'x' })]);
    const r = confirmarTodos(c, 'u2', 'now');
    expect(r.diasRojos.every((d) => d.estado === 'confirmado')).toBe(true);
    expect(r.diasRojos[0].confirmadoPor).toBe('u2');
    expect(r.diasRojos[1].confirmadoPor).toBe('a');
  });
});

describe('anadirDiaManual', () => {
  it('añade un día manual ya confirmado y lo saca de descartados', () => {
    const r = anadirDiaManual(capa([], ['2026-05-02']), { fecha: '2026-05-02', nombre: 'Fiesta local', ambito: 'local' }, 'u1', 'now');
    expect(r.diasRojos).toEqual([
      { fecha: '2026-05-02', nombre: 'Fiesta local', ambito: 'local', estado: 'confirmado', origen: 'manual', confirmadoPor: 'u1', confirmadoAt: 'now' },
    ]);
    expect(r.descartados).toEqual([]);
  });
  it('sobrescribe un día existente de la misma fecha', () => {
    const r = anadirDiaManual(capa([dia('2026-05-02')]), { fecha: '2026-05-02', nombre: 'Otra', ambito: 'local' }, 'u1', 'now');
    expect(r.diasRojos).toHaveLength(1);
    expect(r.diasRojos[0]).toMatchObject({ nombre: 'Otra', origen: 'manual', estado: 'confirmado' });
  });
});

describe('aniosAfectados', () => {
  it('lista todos los años entre notificación y el plazo, inclusive', () => {
    expect(aniosAfectados('2026-12-20', '2027-01-15')).toEqual([2026, 2027]);
    expect(aniosAfectados('2026-03-01', '2026-03-10')).toEqual([2026]);
    expect(aniosAfectados('2026-12-20', '2028-01-02')).toEqual([2026, 2027, 2028]);
  });
});

describe('resolverCapas', () => {
  it('con partido usa su CA y la capa del partido', () => {
    const r = resolverCapas({ partidoJudicialId: '28-21' }, 'cataluna');
    expect(r.ca).toBe('ca-madrid');
    expect(r.partido).toBe('pj-28-21');
    expect(r.advertencias).toEqual([]);
  });
  it('sin partido usa la CA de la empresa y avisa', () => {
    const r = resolverCapas({}, 'cataluna');
    expect(r.ca).toBe('ca-cataluna');
    expect(r.partido).toBeUndefined();
    expect(r.advertencias).toEqual(['sin_partido']);
  });
  it('partido desconocido cae a la CA de la empresa y avisa', () => {
    const r = resolverCapas({ partidoJudicialId: 'zz-9' }, 'cataluna');
    expect(r.ca).toBe('ca-cataluna');
    expect(r.advertencias).toEqual(['sin_partido']);
  });
});
