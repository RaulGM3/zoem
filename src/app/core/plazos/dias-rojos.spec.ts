import { describe, it, expect } from 'vitest';
import {
  componerDiasRojos, fusionarPropuestas, idCapaAutonomica, idCapaPartido, DOMINIOS_OFICIALES, esDominioOficial,
} from './dias-rojos';
import type { CapaAnio, DiaRojo } from './dias-rojos';

const rojo = (fecha: string, nombre: string, extra: Partial<DiaRojo> = {}): DiaRojo => ({
  fecha, nombre, ambito: 'nacional', estado: 'confirmado', origen: 'manual', ...extra,
});
const capa = (diasRojos: DiaRojo[] = [], descartados: string[] = []): CapaAnio => ({ diasRojos, descartados });

describe('ids de capa', () => {
  it('autonómica y partido', () => {
    expect(idCapaAutonomica('castilla_la_mancha')).toBe('ca-castilla_la_mancha');
    expect(idCapaPartido('45-1')).toBe('pj-45-1');
  });
});

describe('componerDiasRojos', () => {
  it('sin capas devuelve mapa vacío', () => {
    expect(componerDiasRojos().size).toBe(0);
  });
  it('ignora los días propuestos', () => {
    const m = componerDiasRojos(capa([rojo('2026-01-01', 'Año Nuevo'), rojo('2026-04-02', 'Jueves Santo', { estado: 'propuesto', origen: 'ia' })]));
    expect([...m.keys()]).toEqual(['2026-01-01']);
  });
  it('compone capa autonómica de Castilla-La Mancha con la del partido', () => {
    const ca = capa([rojo('2026-05-31', 'Día de la Región', { ambito: 'autonomico' })]);
    const pj = capa([rojo('2026-09-08', 'Virgen de la Salud', { ambito: 'local' })]);
    const m = componerDiasRojos(ca, pj);
    expect(m.get('2026-05-31')?.ambito).toBe('autonomico');
    expect(m.get('2026-09-08')?.nombre).toBe('Virgen de la Salud');
    expect(m.size).toBe(2);
  });
  it('el partido sobreescribe la misma fecha', () => {
    const ca = capa([rojo('2026-05-15', 'A', { ambito: 'autonomico' })]);
    const pj = capa([rojo('2026-05-15', 'San Isidro', { ambito: 'local' })]);
    expect(componerDiasRojos(ca, pj).get('2026-05-15')?.nombre).toBe('San Isidro');
  });
  it('un propuesto del partido no pisa un confirmado de la comunidad', () => {
    const ca = capa([rojo('2026-05-15', 'A')]);
    const pj = capa([rojo('2026-05-15', 'B', { estado: 'propuesto', origen: 'ia' })]);
    expect(componerDiasRojos(ca, pj).get('2026-05-15')?.nombre).toBe('A');
  });
});

describe('esDominioOficial', () => {
  it('acepta BOE, gob.es y boletines autonómicos', () => {
    for (const u of [
      'https://www.boe.es/diario_boe/txt.php?id=1',
      'https://www.mites.gob.es/x',
      'https://dogc.gencat.cat/x',
      'https://www.juntadeandalucia.es/boja',
      'https://www.comunidad.madrid/x',
      'https://bop.dipucr.es/x',
      'https://www.dipucadiz.es/x',
      'https://www.bocm.es/boletin/x',
      'https://www.borm.es/x',
      'https://www.bocce.es/x',
    ]) expect(esDominioOficial(u), u).toBe(true);
  });
  it('rechaza dominios no oficiales y suplantaciones', () => {
    for (const u of ['https://blog.com/festivos', 'https://boe.es.evil.com/x', 'https://notboe.es/x', 'javascript:alert(1)', 'no-es-url'])
      expect(esDominioOficial(u), u).toBe(false);
  });
  it('lista documentada', () => {
    expect(DOMINIOS_OFICIALES).toContain('boe.es');
  });
});

describe('fusionarPropuestas', () => {
  const ok = { fuenteUrl: 'https://www.boe.es/x' };
  const prop = (fecha: string, extra: Record<string, unknown> = {}) => ({ fecha, nombre: 'N', ambito: 'autonomico' as const, ...ok, ...extra });

  it('añade nueva como propuesta/ia', () => {
    const r = fusionarPropuestas(capa(), [prop('2026-03-19')], 2026, []);
    expect(r.añadidos).toBe(1);
    expect(r.capa.diasRojos[0]).toMatchObject({ fecha: '2026-03-19', estado: 'propuesto', origen: 'ia', fuenteUrl: ok.fuenteUrl });
  });
  it('descarta sin fuente', () => {
    const r = fusionarPropuestas(capa(), [prop('2026-03-19', { fuenteUrl: undefined })], 2026, []);
    expect(r.capa.diasRojos).toHaveLength(0);
    expect(r.descartadas).toEqual([{ fecha: '2026-03-19', motivo: 'sin_fuente' }]);
  });
  it('descarta dominio no oficial', () => {
    const r = fusionarPropuestas(capa(), [prop('2026-03-19', { fuenteUrl: 'https://blog.com/x' })], 2026, []);
    expect(r.descartadas[0].motivo).toBe('dominio_no_oficial');
  });
  it('con grounding exige que el dominio esté entre los encontrados', () => {
    const a = fusionarPropuestas(capa(), [prop('2026-03-19')], 2026, ['boe.es']);
    expect(a.añadidos).toBe(1);
    const b = fusionarPropuestas(capa(), [prop('2026-03-19')], 2026, ['dogc.gencat.cat']);
    expect(b.añadidos).toBe(0);
    expect(b.descartadas[0].motivo).toBe('dominio_fuera_de_busqueda');
  });
  it('descarta otro año', () => {
    const r = fusionarPropuestas(capa(), [prop('2027-03-19')], 2026, []);
    expect(r.descartadas[0].motivo).toBe('otro_anio');
  });
  it('descarta fechas descartadas por el usuario', () => {
    const r = fusionarPropuestas(capa([], ['2026-03-19']), [prop('2026-03-19')], 2026, []);
    expect(r.descartadas[0].motivo).toBe('descartado_por_usuario');
    expect(r.capa.diasRojos).toHaveLength(0);
  });
  it('nunca toca confirmados ni manuales', () => {
    const conf = rojo('2026-03-19', 'Conf', { origen: 'ia' });
    const man = rojo('2026-03-20', 'Man', { estado: 'propuesto', origen: 'manual' });
    const r = fusionarPropuestas(capa([conf, man]), [prop('2026-03-19', { nombre: 'X' }), prop('2026-03-20', { nombre: 'Y' })], 2026, []);
    expect(r.capa.diasRojos).toEqual([conf, man]);
    expect(r.añadidos).toBe(0);
    expect(r.descartadas.map((d) => d.motivo)).toEqual(['ya_existe', 'ya_existe']);
  });
  it('propuesto existente: solo actualiza nombre y fuente', () => {
    const ex = rojo('2026-03-19', 'Viejo', { estado: 'propuesto', origen: 'ia', ambito: 'local', fuenteUrl: 'https://www.boe.es/old' });
    const r = fusionarPropuestas(capa([ex]), [prop('2026-03-19', { nombre: 'Nuevo', fuenteUrl: 'https://www.boe.es/new' })], 2026, []);
    expect(r.capa.diasRojos).toEqual([{ ...ex, nombre: 'Nuevo', fuenteUrl: 'https://www.boe.es/new' }]);
    expect(r.añadidos).toBe(0);
  });
  it('dedupe dentro de las propuestas', () => {
    const r = fusionarPropuestas(capa(), [prop('2026-03-19'), prop('2026-03-19', { nombre: 'Otra' })], 2026, []);
    expect(r.capa.diasRojos).toHaveLength(1);
    expect(r.añadidos).toBe(1);
    expect(r.descartadas[0].motivo).toBe('duplicada');
  });
  it('no muta la capa original', () => {
    const actual = capa([rojo('2026-01-01', 'A')]);
    fusionarPropuestas(actual, [prop('2026-03-19')], 2026, []);
    expect(actual.diasRojos).toHaveLength(1);
  });
  it('conserva ultimaBusquedaIa y descartados', () => {
    const actual: CapaAnio = { diasRojos: [], descartados: ['2026-02-02'], ultimaBusquedaIa: { ejecutadaAt: 'x', ejecutadaPor: 'u', propuestos: 1 } };
    const r = fusionarPropuestas(actual, [], 2026, []);
    expect(r.capa).toEqual(actual);
  });
});
