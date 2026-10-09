import { describe, expect, it } from 'vitest';
import { construirLlamadasDemo, fechaMadrid } from './llamadasDemo';
import { LLAMADAS } from './datosLlamadasDemo';
import { LLAMADAS as LLAMADAS_CLIENTE } from '../../../src/app/core/demo/datos-demo-civil';
import { construirSeedDemo } from '../../../src/app/core/demo/seed-demo-civil';

const ahora = new Date('2026-10-09T10:00:00Z');

describe('fechaMadrid', () => {
  it('convierte hora de pared de Madrid a instante (horario de invierno y de verano)', () => {
    expect(fechaMadrid(new Date('2026-01-15T10:00:00Z'), 0, 8, 47).toISOString()).toBe('2026-01-15T07:47:00.000Z');
    expect(fechaMadrid(new Date('2026-07-15T10:00:00Z'), 0, 8, 47).toISOString()).toBe('2026-07-15T06:47:00.000Z');
  });
  it('resta días respecto a hoy', () => {
    expect(fechaMadrid(new Date('2026-10-09T10:00:00Z'), -2, 12, 0).toISOString()).toBe('2026-10-07T10:00:00.000Z');
  });
});

describe('construirLlamadasDemo', () => {
  const docs = construirLlamadasDemo('c1', ahora);

  it('crea el agente y una llamada por cada una de LLAMADAS, con ids deterministas', () => {
    expect(docs).toHaveLength(LLAMADAS.length + 1);
    expect(docs[0]).toMatchObject({
      path: 'agentMappings/demo-agente-c1',
      data: { agentId: 'demo-agente-c1', companyId: 'c1' },
    });
    expect(docs.slice(1).map((d) => d.path)).toEqual(LLAMADAS.map((l) => `llamadas/demo-c1-llamada-${l.key}`));
  });

  it('cada llamada cuelga del agente y de la empresa por agentMappings', () => {
    for (const d of docs.slice(1)) expect(d.data['agentId']).toBe('demo-agente-c1');
  });

  it('es idempotente: misma entrada, mismos docs', () => {
    expect(construirLlamadasDemo('c1', ahora)).toEqual(docs);
  });

  it('no escribe undefined (Firestore lo rechaza)', () => {
    for (const d of docs) expect(JSON.stringify(d.data)).not.toContain('undefined');
    expect(Object.values(docs[1].data).some((v) => v === undefined)).toBe(false);
  });
});

describe('sincronía con el seed del cliente', () => {
  it('LLAMADAS es idéntico al del cliente', () => {
    expect(LLAMADAS).toEqual(LLAMADAS_CLIENTE);
  });
  it('mismos campos que las llamadas que construiría el seed (salvo la fecha)', () => {
    const hoy = new Date(2026, 9, 6, 9, 30);
    const seed = construirSeedDemo({
      companyId: 'c1', miembros: [{ uid: 'u', nombre: 'Ana', role: 'Admin' }], hoy, ultimaFacturaPorAnio: {},
      agente: { agentId: 'demo-agente-c1', crear: true },
    });
    const delSeed = seed.docs.filter((d) => d.path.startsWith('llamadas/'));
    const nuestras = construirLlamadasDemo('c1', hoy).slice(1);
    expect(nuestras.map((d) => d.path)).toEqual(delSeed.map((d) => d.path));
    const sinFecha = (o: Record<string, unknown>) => {
      const { creadoEn: _c, ...resto } = o;
      return JSON.parse(JSON.stringify(resto));
    };
    expect(nuestras.map((d) => sinFecha(d.data))).toEqual(delSeed.map((d) => sinFecha(d.data as Record<string, unknown>)));
    expect(docs0Agent(seed.docs)).toMatchObject({ agentId: 'demo-agente-c1', companyId: 'c1' });
  });
});

function docs0Agent(docs: { path: string; data: unknown }[]) {
  return docs.find((d) => d.path.startsWith('agentMappings/'))!.data;
}
