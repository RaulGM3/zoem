import { describe, it, expect } from 'vitest';
import { buscarPartidos, partidoPorId, PARTIDOS_JUDICIALES } from './partidos-judiciales';

describe('PARTIDOS_JUDICIALES', () => {
  it('431 sedes con ids únicos', () => {
    expect(PARTIDOS_JUDICIALES).toHaveLength(431);
    expect(new Set(PARTIDOS_JUDICIALES.map((p) => p.id)).size).toBe(431);
  });
  it('Toledo está en Castilla-La Mancha', () => {
    const toledo = PARTIDOS_JUDICIALES.find((p) => p.nombre === 'Toledo');
    expect(toledo?.ca).toBe('castilla_la_mancha');
    expect(toledo?.provincia).toBe('Toledo');
  });
  it('incluye Ceuta y Melilla', () => {
    expect(PARTIDOS_JUDICIALES.find((p) => p.nombre === 'Ceuta')?.ca).toBe('ceuta');
    expect(PARTIDOS_JUDICIALES.find((p) => p.nombre === 'Melilla')?.ca).toBe('melilla');
  });
});

describe('buscarPartidos', () => {
  it('ignora tildes y mayúsculas', () => {
    const nombres = buscarPartidos('ALCALA').map((p) => p.nombre);
    expect(nombres).toEqual(expect.arrayContaining(['Alcalá de Henares', 'Alcalá la Real', 'Alcalá de Guadaíra']));
  });
  it('con ca Madrid, Alcalá de Henares va primero', () => {
    expect(buscarPartidos('alcala', { ca: 'madrid' })[0].nombre).toBe('Alcalá de Henares');
  });
  it('pozuelo → Pozuelo de Alarcón (28-21)', () => {
    const r = buscarPartidos('pozuelo');
    expect(r[0].nombre).toBe('Pozuelo de Alarcón');
    expect(r[0].id).toBe('28-21');
  });
  it('prefijo antes que contiene', () => {
    const r = buscarPartidos('toledo');
    expect(r[0].nombre).toBe('Toledo');
  });
  it('contiene si no hay prefijo', () => {
    expect(buscarPartidos('henares').map((p) => p.nombre)).toContain('Alcalá de Henares');
  });
  it('texto vacío o sin coincidencias', () => {
    expect(buscarPartidos('')).toEqual([]);
    expect(buscarPartidos('zzzzzz')).toEqual([]);
  });
  it('respeta el límite', () => {
    expect(buscarPartidos('a', { limite: 5 })).toHaveLength(5);
  });
  it('busca también por provincia', () => {
    expect(buscarPartidos('ciudad real')[0].nombre).toBe('Ciudad Real');
  });
});

describe('partidoPorId', () => {
  it('encuentra y devuelve undefined si no existe', () => {
    expect(partidoPorId('28-21')?.nombre).toBe('Pozuelo de Alarcón');
    expect(partidoPorId('99-1')).toBeUndefined();
  });
});
