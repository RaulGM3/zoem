import { describe, expect, it } from 'vitest';
import type { Suscripcion } from './catalogo';
import { etiquetasEmpresa } from './etiquetas-empresa';

const ahora = new Date('2026-10-09T12:00:00Z');
const sus = (over: Partial<Suscripcion>): Suscripcion => ({ plan: 'free', complementos: [], estado: 'activa', origen: 'free', ...over });

describe('etiquetasEmpresa', () => {
  it('empresa legada sin suscripcion: pro (legada), sin marcas', () => {
    expect(etiquetasEmpresa({}, ahora)).toEqual({ plan: 'pro (legada)', marcas: [] });
  });

  it('autoservicio en prueba: free + Autoservicio + días', () => {
    const r = etiquetasEmpresa(
      { autoservicio: true, suscripcion: sus({ estado: 'prueba', periodoFin: new Date('2026-10-12T12:00:00Z') }) },
      ahora,
    );
    expect(r).toEqual({ plan: 'free', marcas: ['Autoservicio', 'Prueba · 3 d'] });
  });

  it('prueba terminada sin persistir aún: Prueba vencida', () => {
    const r = etiquetasEmpresa({ suscripcion: sus({ estado: 'prueba', periodoFin: new Date('2026-10-01') }) }, ahora);
    expect(r.marcas).toEqual(['Prueba vencida']);
  });

  it('demo', () => {
    expect(etiquetasEmpresa({ esDemo: true, suscripcion: sus({ plan: 'demo', origen: 'manual' }) }, ahora)).toEqual({
      plan: 'demo',
      marcas: ['Demo'],
    });
  });
});
