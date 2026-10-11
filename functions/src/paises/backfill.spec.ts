import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo .mjs de scripts/ sin tipos
import { parchePaisMoneda, MONEDA_LOCAL } from '../../../scripts/backfill-pais-moneda.lib.mjs';
import { PAISES } from './catalogo-paises';

describe('backfill país/moneda', () => {
  it('añade ES/EUR a una empresa sin ninguno', () => {
    expect(parchePaisMoneda({ name: 'Acme' })).toEqual({ pais: 'ES', moneda: 'EUR' });
  });
  it('es idempotente y no pisa lo existente', () => {
    expect(parchePaisMoneda({ pais: 'ES', moneda: 'EUR' })).toEqual({});
    expect(parchePaisMoneda({ pais: 'CO', moneda: 'USD' })).toEqual({});
  });
  it('completa solo lo que falta', () => {
    expect(parchePaisMoneda({ pais: 'CO' })).toEqual({ moneda: 'COP' });
    expect(parchePaisMoneda({ moneda: 'EUR' })).toEqual({ pais: 'ES' });
    expect(parchePaisMoneda({ pais: '', moneda: '' })).toEqual({ pais: 'ES', moneda: 'EUR' });
  });
  it('la tabla de monedas locales coincide con el catálogo', () => {
    expect(MONEDA_LOCAL).toEqual(Object.fromEntries(PAISES.map((p) => [p.codigo, p.moneda])));
  });
});
