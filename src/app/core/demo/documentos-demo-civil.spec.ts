import { describe, it, expect } from 'vitest';
import { documentosDemo } from './documentos-demo-civil';
import { CASOS } from './datos-demo-civil';

describe('documentosDemo', () => {
  const docs = documentosDemo('Despacho Demo', new Date(2026, 9, 6));

  it('genera una veintena de documentos repartidos por los casos', () => {
    expect(docs.length).toBeGreaterThanOrEqual(18);
    const casos = new Set(CASOS.map((c) => `demo-caso-${c.key}`));
    for (const d of docs) expect(casos.has(d.casoId)).toBe(true);
    expect(new Set(docs.map((d) => d.casoId)).size).toBeGreaterThanOrEqual(8);
  });

  it('ids únicos y deterministas, nombres .docx', () => {
    expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
    expect(documentosDemo('Despacho Demo', new Date(2026, 9, 6)).map((d) => d.id)).toEqual(docs.map((d) => d.id));
    for (const d of docs) expect(d.nombre.endsWith('.docx')).toBe(true);
  });

  it('el HTML está completo: sin huecos ni marcado sin escapar', () => {
    for (const d of docs) {
      expect(d.html).toContain('<h1');
      expect(d.html).not.toMatch(/undefined|NaN|\$\{/);
    }
    expect(docs.some((d) => d.html.includes('Despacho Demo'))).toBe(true);
  });
});
