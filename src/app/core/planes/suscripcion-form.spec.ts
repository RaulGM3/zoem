import { describe, it, expect } from 'vitest';
import type { Suscripcion } from './catalogo';
import { formDesdeSuscripcion, suscripcionDesdeForm } from './suscripcion-form';

describe('suscripcionDesdeForm', () => {
  it('sin plan elegido no escribe suscripcion (empresa legada)', () => {
    expect(suscripcionDesdeForm({ plan: '', estado: 'activa', periodoFin: '', complementos: [] })).toBeUndefined();
  });

  it('construye la suscripcion manual', () => {
    const s = suscripcionDesdeForm({ plan: 'pro', estado: 'activa', periodoFin: '', complementos: ['tesoreria'] })!;
    expect(s).toEqual({ plan: 'pro', estado: 'activa', complementos: ['tesoreria'], origen: 'manual' });
    expect('periodoFin' in s).toBe(false);
  });

  it('periodoFin llega como Date al final del día (UTC)', () => {
    const s = suscripcionDesdeForm({ plan: 'free', estado: 'prueba', periodoFin: '2026-10-23', complementos: [] })!;
    expect(s.periodoFin).toEqual(new Date('2026-10-23T23:59:59Z'));
  });

  it('conserva ajustes y origen previos (p. ej. stripe)', () => {
    const previa: Suscripcion = {
      plan: 'pro', estado: 'activa', complementos: [], origen: 'stripe', ajustes: { limites: { usuarios: 20 } },
    };
    const s = suscripcionDesdeForm({ plan: 'pro', estado: 'activa', periodoFin: '', complementos: [] }, previa)!;
    expect(s.ajustes).toEqual({ limites: { usuarios: 20 } });
    expect(s.origen).toBe('stripe');
  });
});

describe('formDesdeSuscripcion', () => {
  it('sin suscripcion: plan vacío', () => {
    expect(formDesdeSuscripcion(undefined)).toEqual({ plan: '', estado: 'activa', periodoFin: '', complementos: [] });
  });
  it('lee Timestamp y lo pasa a yyyy-mm-dd', () => {
    const f = formDesdeSuscripcion({
      plan: 'free', estado: 'prueba', complementos: ['tesoreria'], origen: 'free',
      periodoFin: { toDate: () => new Date('2026-10-23T23:59:59Z') },
    });
    expect(f).toEqual({ plan: 'free', estado: 'prueba', periodoFin: '2026-10-23', complementos: ['tesoreria'] });
  });
});
