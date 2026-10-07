import { describe, expect, it } from 'vitest';
import type { DiaInhabil } from './calendario-judicial';
import { agruparParaRevision, alternarDias, diasAMostrar, fusionarCandidatos, itemMarcado } from './revision-dias';

const d = (fecha: string, motivo: DiaInhabil['motivo'] = 'festivo', etiqueta = 'X'): DiaInhabil => ({ fecha, motivo, etiqueta });
const agosto = (n: number): DiaInhabil[] => Array.from({ length: n }, (_, i) => d(`2026-08-${String(i + 1).padStart(2, '0')}`, 'agosto', 'Agosto inhábil'));

describe('fusionarCandidatos', () => {
  it('une por fecha, sin duplicar, ordenado', () => {
    const r = fusionarCandidatos([d('2026-10-12')], [d('2026-10-10', 'sabado'), d('2026-10-12')]);
    expect(r.map((x) => x.fecha)).toEqual(['2026-10-10', '2026-10-12']);
  });
});

describe('diasAMostrar', () => {
  const cands = [d('2026-10-10', 'sabado'), d('2026-10-12'), d('2026-11-01', 'domingo')];
  it('muestra los inhábiles actuales y los desmarcados que siguen dentro del plazo', () => {
    const actuales = [d('2026-10-10', 'sabado')];
    const r = diasAMostrar(cands, actuales, ['2026-10-12'], '2026-10-21');
    expect(r.map((x) => x.fecha)).toEqual(['2026-10-10', '2026-10-12']);
  });
  it('un desmarcado posterior al vencimiento ya no es relevante', () => {
    expect(diasAMostrar(cands, [], ['2026-11-01'], '2026-10-21')).toEqual([]);
  });
});

describe('agruparParaRevision', () => {
  it('agrupa agosto (>= 5 días) en un solo elemento; el resto va suelto con su fuente', () => {
    const items = agruparParaRevision([d('2026-07-25', 'sabado', 'Sábado'), ...agosto(31), d('2026-10-12', 'festivo', 'Fiesta Nacional')], { '2026-10-12': 'https://boe.es' });
    expect(items.map((i) => i.etiqueta)).toEqual(['Sábado', 'Agosto 2026 (31 días)', 'Fiesta Nacional']);
    expect(items[1].fechas).toHaveLength(31);
    expect(items[2].fuenteUrl).toBe('https://boe.es');
  });
  it('pocos días de agosto se muestran sueltos', () => {
    expect(agruparParaRevision(agosto(3), {})).toHaveLength(3);
  });
});

describe('marcado y alternancia', () => {
  const [grupo] = agruparParaRevision(agosto(31), {});
  it('un grupo está marcado si ninguno de sus días está excluido', () => {
    expect(itemMarcado(grupo, [])).toBe(true);
    expect(itemMarcado(grupo, ['2026-08-03'])).toBe(false);
  });
  it('desmarcar añade a excluidos; marcar los quita', () => {
    const e = alternarDias(['2026-10-12'], ['2026-08-01', '2026-08-02'], false);
    expect(e).toEqual(['2026-10-12', '2026-08-01', '2026-08-02']);
    expect(alternarDias(e, ['2026-08-01', '2026-08-02'], true)).toEqual(['2026-10-12']);
  });
});
