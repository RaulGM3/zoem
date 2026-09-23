import { describe, it, expect } from 'vitest';
import { normalizar, rankMatches, type Rankable } from './matching';

/** Atajo para construir candidatos legibles en los tests. */
const item = (id: string, label: string): Rankable => ({ id, label });

describe('normalizar', () => {
  it('pasa a minúsculas y quita acentos', () => {
    expect(normalizar('Villa GARRAPATA Ñoño Áéíóú')).toBe('villa garrapata ñoño aeiou');
  });

  it('colapsa espacios y recorta los extremos', () => {
    expect(normalizar('  villa   garrapata  ')).toBe('villa garrapata');
  });

  it('preserva la ñ, que en español SÍ distingue palabras', () => {
    expect(normalizar('Peña')).not.toBe(normalizar('Pena'));
  });
});

describe('rankMatches', () => {
  const casos: Rankable[] = [
    item('c-1', 'Villa Garrapata S.L. — reclamación'),
    item('c-2', 'Herencia Martínez'),
    item('c-3', 'Despido improcedente Garrapata'),
    item('c-4', 'Villa Serena'),
  ];

  it('encuentra por prefijo tolerando mayúsculas y acentos', () => {
    const r = rankMatches(casos, 'VILLA GARRAPATA');
    expect(r[0].id).toBe('c-1');
  });

  it('encuentra por acento omitido — el usuario dicta sin tildes', () => {
    const r = rankMatches(casos, 'herencia martinez');
    expect(r.map((x) => x.id)).toEqual(['c-2']);
  });

  it('prioriza el prefijo sobre la coincidencia interna', () => {
    const r = rankMatches(casos, 'garrapata');
    expect(r.map((x) => x.id)).toEqual(['c-1', 'c-3']);
  });

  it('empareja por tokens sueltos en cualquier orden', () => {
    const r = rankMatches(casos, 'garrapata villa');
    expect(r[0].id).toBe('c-1');
  });

  it('devuelve vacío cuando nada se parece — el agente debe poder decir "no lo encuentro"', () => {
    expect(rankMatches(casos, 'concurso de acreedores')).toEqual([]);
  });

  it('devuelve vacío con consulta vacía o de solo espacios', () => {
    expect(rankMatches(casos, '')).toEqual([]);
    expect(rankMatches(casos, '   ')).toEqual([]);
  });

  it('respeta el límite de resultados', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => item(`c-${i}`, `Caso Garrapata ${i}`));
    expect(rankMatches(muchos, 'garrapata', 5)).toHaveLength(5);
  });

  it('ante igual puntuación prefiere la etiqueta más corta — es la más específica', () => {
    const ambiguos = [
      item('largo', 'Garrapata con un título francamente interminable'),
      item('corto', 'Garrapata'),
    ];
    expect(rankMatches(ambiguos, 'garrapata')[0].id).toBe('corto');
  });

  it('ignora candidatos sin etiqueta en vez de romper', () => {
    const conVacio = [item('vacio', ''), item('c-1', 'Villa Garrapata')];
    expect(rankMatches(conVacio, 'villa').map((x) => x.id)).toEqual(['c-1']);
  });

  it('conserva el objeto original para que la tool pueda devolver sus campos', () => {
    const conExtra = [{ id: 'c-1', label: 'Villa Garrapata', estado: 'urgente' }];
    expect(rankMatches(conExtra, 'villa')[0].estado).toBe('urgente');
  });
});
