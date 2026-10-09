import { describe, expect, it } from 'vitest';
import { despachoRealAlternativo } from './demo-terminada';

const m = (companyId: string, company?: Record<string, unknown>) => ({ companyId, company });

describe('despachoRealAlternativo', () => {
  it('devuelve el primer despacho que no es el activo ni una demo', () => {
    const r = despachoRealAlternativo(
      [m('demo1', { esDemo: true }), m('real1', { name: 'García' }), m('real2', { name: 'Otro' })],
      'demo1',
    );
    expect(r).toEqual({ id: 'real1', nombre: 'García' });
  });
  it('ignora otras demos aunque no sean la activa', () => {
    expect(despachoRealAlternativo([m('d1', { esDemo: true }), m('d2', { suscripcion: { plan: 'demo' as const } })], 'd1')).toBeNull();
  });
  it('sin alternativa => null', () => {
    expect(despachoRealAlternativo([m('demo1', { esDemo: true })], 'demo1')).toBeNull();
    expect(despachoRealAlternativo([], 'x')).toBeNull();
  });
  it('sin nombre usa el id', () => {
    expect(despachoRealAlternativo([m('real1')], 'demo1')).toEqual({ id: 'real1', nombre: 'real1' });
  });
});
