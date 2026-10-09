import { describe, it, expect } from 'vitest';
import { FUNCIONES_DE_PAGO } from './catalogo';
import { PLANES_INFO, textosMejora } from './textos-mejora';

describe('textosMejora', () => {
  it('cada función de pago tiene título, descripción y beneficios', () => {
    for (const f of FUNCIONES_DE_PAGO) {
      const t = textosMejora(f);
      expect(t.titulo.length).toBeGreaterThan(0);
      expect(t.descripcion.length).toBeGreaterThan(0);
      expect(t.beneficios.length).toBeGreaterThan(0);
    }
  });
  it('una función sin texto propio cae a un texto genérico', () => {
    expect(textosMejora('contactos').titulo.length).toBeGreaterThan(0);
  });
  it('documentos tiene texto propio de almacenamiento', () => {
    expect(textosMejora('documentos').titulo).toMatch(/almacenamiento/i);
  });
  it('describe los tres planes públicos', () => {
    expect(PLANES_INFO.map((p) => p.id)).toEqual(['free', 'pro', 'enterprise']);
  });
});
