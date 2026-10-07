import { describe, it, expect } from 'vitest';
import { agruparPorAmbito, capasEnUso, fechaConDiaSemana, hayConfirmados, textoDescarte } from './vista-dias-inhabiles';
import type { DiaRojo } from './dias-rojos';

const dia = (extra: Partial<DiaRojo>): DiaRojo => ({
  fecha: '2026-01-01', nombre: 'Año Nuevo', ambito: 'nacional', estado: 'confirmado', origen: 'manual', ...extra,
});

describe('fechaConDiaSemana', () => {
  it('dd/mm/yyyy y día de la semana en español', () => {
    expect(fechaConDiaSemana('2026-01-01')).toBe('01/01/2026 · jueves');
    expect(fechaConDiaSemana('2026-03-15')).toBe('15/03/2026 · domingo');
  });
});

describe('agruparPorAmbito', () => {
  it('agrupa en orden Nacional, Autonómico, Local, Personalizado; omite vacíos y ordena por fecha', () => {
    const grupos = agruparPorAmbito([
      dia({ fecha: '2026-12-25', ambito: 'nacional' }),
      dia({ fecha: '2026-05-01', ambito: 'personalizado' }),
      dia({ fecha: '2026-01-01', ambito: 'nacional' }),
      dia({ fecha: '2026-04-23', ambito: 'autonomico' }),
    ]);
    expect(grupos.map((g) => g.label)).toEqual(['Nacional', 'Autonómico', 'Personalizado']);
    expect(grupos[0].dias.map((d) => d.fecha)).toEqual(['2026-01-01', '2026-12-25']);
  });

  it('sin días devuelve []', () => {
    expect(agruparPorAmbito([])).toEqual([]);
  });
});

describe('hayConfirmados', () => {
  it('false si no hay capa o solo hay propuestos', () => {
    expect(hayConfirmados(undefined)).toBe(false);
    expect(hayConfirmados({ diasRojos: [dia({ estado: 'propuesto' })], descartados: [] })).toBe(false);
  });
  it('true con al menos un confirmado', () => {
    expect(hayConfirmados({ diasRojos: [dia({})], descartados: [] })).toBe(true);
  });
});

describe('capasEnUso', () => {
  it('la capa de la CA de la empresa va primera', () => {
    expect(capasEnUso([], 'madrid')).toEqual([{ id: 'ca-madrid', etiqueta: 'Comunidad de Madrid (autonómica)' }]);
  });

  it('añade partidos únicos de los casos, y la CA de ese partido si difiere', () => {
    const capas = capasEnUso(
      [{ partidoJudicialId: '28-1' }, { partidoJudicialId: '28-1' }, { partidoJudicialId: '46-1' }, {}, { partidoJudicialId: 'no-existe' }],
      'madrid',
    );
    const ids = capas.map((c) => c.id);
    expect(ids[0]).toBe('ca-madrid');
    expect(ids).toContain('pj-28-1');
    expect(ids).toContain('pj-46-1');
    expect(ids).toContain('ca-valencia');
    expect(ids.filter((i) => i === 'pj-28-1')).toHaveLength(1);
    expect(ids).not.toContain('pj-no-existe');
    expect(capas.find((c) => c.id === 'pj-28-1')!.etiqueta).toContain('Partido judicial');
  });

  it('sin CA de empresa solo hay capas derivadas de los partidos', () => {
    expect(capasEnUso([{ partidoJudicialId: '28-1' }], undefined).map((c) => c.id)).toEqual(['pj-28-1', 'ca-madrid']);
  });
});

describe('textoDescarte', () => {
  const motivos = ['sin_fuente', 'dominio_no_oficial', 'dominio_fuera_de_busqueda', 'otro_anio', 'descartado_por_usuario', 'ya_existe', 'duplicada'] as const;
  it('cada motivo tiene un texto en español, distinto y no vacío', () => {
    const textos = motivos.map((m) => textoDescarte(m, 2026));
    expect(new Set(textos).size).toBe(motivos.length);
    for (const t of textos) expect(t.length).toBeGreaterThan(10);
  });
  it('otro_anio menciona el año buscado', () => {
    expect(textoDescarte('otro_anio', 2027)).toContain('2027');
  });
});
