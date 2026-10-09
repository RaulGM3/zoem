import { describe, expect, it } from 'vitest';
import {
  DIAS_DEMO, DIAS_PRUEBA, debeExpirar, demoExpirada, esEmpresaDemo, expirar, suscripcionDemo, suscripcionInicial,
} from './suscripcion';

const ahora = new Date('2026-10-09T12:00:00Z');

describe('suscripcionInicial', () => {
  it('es una prueba free de 14 días', () => {
    const s = suscripcionInicial(ahora);
    expect(s).toMatchObject({ plan: 'free', estado: 'prueba', complementos: [], origen: 'free' });
    expect(s.periodoFin.toISOString()).toBe('2026-10-23T12:00:00.000Z');
    expect(DIAS_PRUEBA).toBe(14);
  });
});

describe('suscripcionDemo', () => {
  it('es demo activa de origen manual y dura 14 días desde la creación', () => {
    const s = suscripcionDemo(ahora);
    expect(s).toMatchObject({ plan: 'demo', estado: 'activa', complementos: [], origen: 'manual' });
    expect(s.periodoFin.toISOString()).toBe('2026-10-23T12:00:00.000Z');
    expect(DIAS_DEMO).toBe(14);
  });
});

describe('esEmpresaDemo', () => {
  it('detecta esDemo y plan demo', () => {
    expect(esEmpresaDemo({ esDemo: true })).toBe(true);
    expect(esEmpresaDemo({ suscripcion: { plan: 'demo' } })).toBe(true);
  });
  it('false para el resto o null', () => {
    expect(esEmpresaDemo({ suscripcion: { plan: 'free' } })).toBe(false);
    expect(esEmpresaDemo({})).toBe(false);
    expect(esEmpresaDemo(null)).toBe(false);
    expect(esEmpresaDemo(undefined)).toBe(false);
  });
});

describe('debeExpirar', () => {
  const base = { suscripcion: { plan: 'free', estado: 'prueba', periodoFin: new Date('2026-10-09T11:59:00Z') } };
  it('expira una prueba cuyo periodoFin ya pasó (acepta Date y Timestamp)', () => {
    expect(debeExpirar(base, ahora)).toBe(true);
    expect(debeExpirar({ suscripcion: { ...base.suscripcion, periodoFin: { toDate: () => new Date('2026-10-01') } } }, ahora)).toBe(true);
  });
  it('expira exactamente en periodoFin (<=)', () => {
    expect(debeExpirar({ suscripcion: { ...base.suscripcion, periodoFin: ahora } }, ahora)).toBe(true);
  });
  it('no expira si aún queda tiempo, sin fecha, o no es prueba', () => {
    expect(debeExpirar({ suscripcion: { ...base.suscripcion, periodoFin: new Date('2026-10-20') } }, ahora)).toBe(false);
    expect(debeExpirar({ suscripcion: { plan: 'free', estado: 'prueba' } }, ahora)).toBe(false);
    expect(debeExpirar({ suscripcion: { ...base.suscripcion, estado: 'activa' } }, ahora)).toBe(false);
    expect(debeExpirar({}, ahora)).toBe(false);
  });
  it('nunca expira una demo', () => {
    expect(debeExpirar({ esDemo: true, suscripcion: base.suscripcion }, ahora)).toBe(false);
    expect(debeExpirar({ suscripcion: { ...base.suscripcion, plan: 'demo' } }, ahora)).toBe(false);
  });
});

describe('expirar', () => {
  it('pasa a activa conservando el plan declarado y borrando periodoFin', () => {
    expect(expirar({ plan: 'free', estado: 'prueba', complementos: [], origen: 'free' })).toEqual({
      'suscripcion.estado': 'activa',
      'suscripcion.periodoFin': null,
    });
  });
});

describe('demoExpirada', () => {
  const demo = (periodoFin?: Date) => ({ esDemo: true, suscripcion: { plan: 'demo', estado: 'activa', periodoFin } });
  it('true cuando periodoFin <= ahora (acepta Timestamp)', () => {
    expect(demoExpirada(demo(new Date('2026-10-09T11:00:00Z')), ahora)).toBe(true);
    expect(demoExpirada(demo(ahora), ahora)).toBe(true);
    expect(demoExpirada({ suscripcion: { plan: 'demo', estado: 'activa', periodoFin: { toDate: () => new Date('2026-10-01') } } }, ahora)).toBe(true);
  });
  it('false si queda tiempo, no hay fecha (demo antigua) o no es demo', () => {
    expect(demoExpirada(demo(new Date('2026-10-20')), ahora)).toBe(false);
    expect(demoExpirada(demo(), ahora)).toBe(false);
    expect(demoExpirada({ suscripcion: { plan: 'free', estado: 'activa', periodoFin: new Date('2026-10-01') } }, ahora)).toBe(false);
    expect(demoExpirada(null, ahora)).toBe(false);
  });
});
