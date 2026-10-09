import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as aqui from './derechos';
import * as cliente from '../../../src/app/core/planes/derechos';
import { COMPLEMENTOS, type PlanId, type Suscripcion } from './catalogo';

/**
 * Las Functions no importan del cliente, así que catálogo y derechos están copiados.
 * Este spec es la red de seguridad: si alguien toca uno y no el otro, falla.
 */
describe('sincronía con src/app/core/planes', () => {
  it('catalogo.ts es idéntico byte a byte', () => {
    const f = readFileSync(resolve(__dirname, 'catalogo.ts'), 'utf8');
    const c = readFileSync(resolve(__dirname, '../../../src/app/core/planes/catalogo.ts'), 'utf8');
    expect(f).toBe(c);
  });

  it('periodo.ts (mes de uso por zona horaria) es idéntico byte a byte', () => {
    const f = readFileSync(resolve(__dirname, '../uso/periodo.ts'), 'utf8');
    const c = readFileSync(resolve(__dirname, '../../../src/app/core/planes/periodo.ts'), 'utf8');
    expect(f).toBe(c);
  });

  it('derechosEfectivos coincide en una matriz de suscripciones', () => {
    const ahora = new Date('2026-10-09T12:00:00Z');
    const fechas = [undefined, new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z')];
    const planes: PlanId[] = ['free', 'pro', 'enterprise', 'demo'];
    const estados = ['prueba', 'activa', 'vencida', 'cancelada'] as const;
    const complementos = [[], Object.keys(COMPLEMENTOS)] as Suscripcion['complementos'][];
    let n = 0;
    for (const plan of planes) for (const estado of estados) for (const periodoFin of fechas) for (const c of complementos) {
      const s: Suscripcion = { plan, estado, periodoFin, complementos: c, origen: 'manual' };
      expect(aqui.derechosEfectivos(s, ahora)).toEqual(cliente.derechosEfectivos(s, ahora));
      expect(aqui.soloLectura(s, ahora)).toBe(cliente.soloLectura(s, ahora));
      n++;
    }
    expect(n).toBe(96);
    expect(aqui.derechosEfectivos(null, ahora)).toEqual(cliente.derechosEfectivos(null, ahora));
  });
});
