import { describe, expect, it } from 'vitest';
import {
  capaBusquedaDesdeId, construirPrompt, extraerDominios, extraerFuentes, parsearPropuestas, puedeBuscar, COOLDOWN_BUSQUEDA_HORAS,
} from './festivos-ia';

describe('parsearPropuestas', () => {
  it('normaliza fecha ISO y dd/mm/aaaa, recorta nombre y conserva fuenteUrl', () => {
    const r = parsearPropuestas(
      { festivos: [
        { fecha: '2026-10-12', nombre: ' Fiesta Nacional ', ambito: 'nacional', fuenteUrl: 'https://www.boe.es/x' },
        { fecha: '09/11/2026', nombre: 'Almudena', ambito: 'local', fuenteUrl: ' https://bocm.es/y ' },
      ] },
      'autonomica',
    );
    expect(r).toEqual([
      { fecha: '2026-10-12', nombre: 'Fiesta Nacional', ambito: 'nacional', fuenteUrl: 'https://www.boe.es/x' },
      { fecha: '2026-11-09', nombre: 'Almudena', ambito: 'local', fuenteUrl: 'https://bocm.es/y' },
    ]);
  });
  it('ámbito ausente o inválido: autonomico en capa autonómica, local en capa de partido', () => {
    const base = { fecha: '2026-05-02', nombre: 'X', fuenteUrl: 'https://boe.es/a' };
    expect(parsearPropuestas({ festivos: [{ ...base, ambito: 'galáctico' }] }, 'autonomica')[0].ambito).toBe('autonomico');
    expect(parsearPropuestas({ festivos: [base] }, 'partido')[0].ambito).toBe('local');
  });
  it('fuenteUrl vacía o no string queda undefined (la fusión la descartará por sin_fuente)', () => {
    const r = parsearPropuestas({ festivos: [{ fecha: '2026-05-02', nombre: 'X', fuenteUrl: '  ' }] }, 'autonomica');
    expect(r[0].fuenteUrl).toBeUndefined();
  });
  it('descarta entradas con fecha imposible, sin nombre o que no son objetos', () => {
    const r = parsearPropuestas(
      { festivos: [
        { fecha: '2026-02-30', nombre: 'Imposible' }, { fecha: '2026-05-02', nombre: ' ' }, 'x', null,
        { fecha: 'mañana', nombre: 'Y' },
      ] },
      'autonomica',
    );
    expect(r).toEqual([]);
  });
  it('entrada inválida (no objeto, sin lista) devuelve []', () => {
    expect(parsearPropuestas(null, 'autonomica')).toEqual([]);
    expect(parsearPropuestas({ festivos: 'no' }, 'autonomica')).toEqual([]);
    expect(parsearPropuestas('texto', 'partido')).toEqual([]);
  });
});

describe('extraerDominios / extraerFuentes', () => {
  const chunks = [
    { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'boe.es', domain: 'boe.es' } },
    { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/def', title: 'www.bocm.es' } },
    { web: { uri: 'https://www.juntadeandalucia.es/x', title: 'Calendario laboral' } },
    { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/ghi', title: 'Un titulo cualquiera' } },
    { maps: { title: 'mapa' } },
    {},
  ];
  it('usa domain si existe; si no, título con forma de host; si no, host del uri salvo redirecciones de Google', () => {
    expect(extraerDominios(chunks)).toEqual(['boe.es', 'bocm.es', 'juntadeandalucia.es']);
  });
  it('sin chunks devuelve []', () => {
    expect(extraerDominios(undefined)).toEqual([]);
  });
  it('fuentes: título y uri únicos, ignora chunks sin uri', () => {
    const f = extraerFuentes([...chunks, chunks[0]]);
    expect(f).toHaveLength(4);
    expect(f[0]).toEqual({ titulo: 'boe.es', uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc' });
    expect(extraerFuentes([{ web: { uri: 'https://a.es' } }])[0].titulo).toBe('a.es');
  });
  it('fuentes: descarta uris que no son http(s)', () => {
    expect(extraerFuentes([{ web: { uri: 'javascript:alert(1)', title: 'x' } }])).toEqual([]);
  });
});

describe('construirPrompt', () => {
  it('autonómica: festivos nacionales y de la CA, BOE y boletín autonómico, exige fuente por fecha', () => {
    const p = construirPrompt({ tipo: 'autonomica', ca: 'madrid' }, 2026);
    expect(p).toContain('2026');
    expect(p).toContain('Comunidad de Madrid');
    expect(p).toMatch(/Dirección General de Trabajo/);
    expect(p).toMatch(/BOE/);
    expect(p).toMatch(/boletín/i);
    expect(p).toMatch(/sin fuente, NO la incluyas/i);
  });
  it('partido: fiestas locales del municipio sede y provincia', () => {
    const p = construirPrompt({ tipo: 'partido', partidoId: '28-21' }, 2027);
    expect(p).toContain('2027');
    expect(p).toMatch(/fiestas locales/i);
    expect(p).toMatch(/boletín oficial/i);
    expect(p).toMatch(/sin fuente, NO la incluyas/i);
  });
  it('partido inexistente lanza error', () => {
    expect(() => construirPrompt({ tipo: 'partido', partidoId: '99-99' }, 2026)).toThrow();
  });
});

describe('puedeBuscar', () => {
  const ult = { ejecutadaAt: '2026-10-07T10:00:00.000Z', ejecutadaPor: 'u', propuestos: 3 };
  it('sin búsqueda previa: puede', () => {
    expect(puedeBuscar(undefined, '2026-10-07T10:00:00.000Z')).toEqual({ puede: true });
  });
  it('dentro de 24 h: no puede y devuelve cuándo', () => {
    expect(COOLDOWN_BUSQUEDA_HORAS).toBe(24);
    expect(puedeBuscar(ult, '2026-10-08T09:59:59.000Z')).toEqual({ puede: false, desde: '2026-10-08T10:00:00.000Z' });
  });
  it('justo a las 24 h o después: puede', () => {
    expect(puedeBuscar(ult, '2026-10-08T10:00:00.000Z')).toEqual({ puede: true });
    expect(puedeBuscar(ult, '2026-11-01T00:00:00.000Z')).toEqual({ puede: true });
  });
  it('marca ilegible: no bloquea', () => {
    expect(puedeBuscar({ ...ult, ejecutadaAt: 'basura' }, '2026-10-07T10:00:00.000Z')).toEqual({ puede: true });
  });
  it('reloj atrasado respecto a la marca (futuro lejano) no bloquea más de 24 h', () => {
    expect(puedeBuscar({ ...ult, ejecutadaAt: '2030-01-01T00:00:00.000Z' }, '2026-10-07T10:00:00.000Z')).toEqual({ puede: true });
  });
});

describe('capaBusquedaDesdeId', () => {
  it('ca-xxx y pj-xxx se traducen a la capa de búsqueda', () => {
    expect(capaBusquedaDesdeId('ca-castilla_la_mancha')).toEqual({ tipo: 'autonomica', ca: 'castilla_la_mancha' });
    expect(capaBusquedaDesdeId('pj-28-21')).toEqual({ tipo: 'partido', partidoId: '28-21' });
  });
  it('ids desconocidos devuelven null', () => {
    expect(capaBusquedaDesdeId('ca-atlantida')).toBeNull();
    expect(capaBusquedaDesdeId('pj-99-99')).toBeNull();
    expect(capaBusquedaDesdeId('otra')).toBeNull();
  });
});
