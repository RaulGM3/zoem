import { describe, expect, it } from 'vitest';
import { esEmpresaDemo } from './demo';

describe('esEmpresaDemo', () => {
  it('true con esDemo o plan demo', () => {
    expect(esEmpresaDemo({ esDemo: true })).toBe(true);
    expect(esEmpresaDemo({ suscripcion: { plan: 'demo', complementos: [], estado: 'activa', origen: 'manual' } })).toBe(true);
  });
  it('false para empresas normales o sin empresa', () => {
    expect(esEmpresaDemo({ suscripcion: { plan: 'free', complementos: [], estado: 'prueba', origen: 'free' } })).toBe(false);
    expect(esEmpresaDemo({})).toBe(false);
    expect(esEmpresaDemo(null)).toBe(false);
  });
});
