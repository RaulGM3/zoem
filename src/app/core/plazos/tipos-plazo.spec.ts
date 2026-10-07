import { describe, it, expect } from 'vitest';
import { TIPOS_PLAZO } from './tipos-plazo';

describe('TIPOS_PLAZO', () => {
  it('ids únicos y cantidades positivas', () => {
    expect(new Set(TIPOS_PLAZO.map((t) => t.id)).size).toBe(TIPOS_PLAZO.length);
    for (const t of TIPOS_PLAZO) {
      expect(t.cantidad).toBeGreaterThan(0);
      expect(t.etiqueta.length).toBeGreaterThan(0);
    }
  });
  it('incluye los plazos básicos', () => {
    const por = (id: string) => TIPOS_PLAZO.find((t) => t.id === id);
    expect(por('contestacion-verbal')).toMatchObject({ cantidad: 10, unidad: 'dias', jurisdiccion: 'civil' });
    expect(por('contestacion-ordinario')).toMatchObject({ cantidad: 20, unidad: 'dias', jurisdiccion: 'civil' });
    expect(por('apelacion-civil')).toMatchObject({ cantidad: 20 });
    expect(por('reposicion')).toMatchObject({ cantidad: 5 });
    expect(por('recurso-contencioso')).toMatchObject({ cantidad: 2, unidad: 'meses', jurisdiccion: 'contencioso' });
    expect(por('suplicacion-anuncio')).toMatchObject({ cantidad: 5, jurisdiccion: 'laboral' });
    expect(por('apelacion-penal-abreviado')).toMatchObject({ cantidad: 10, jurisdiccion: 'penal' });
  });
});
