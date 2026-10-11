import { describe, expect, it } from 'vitest';
import { geoParaGuardar, nombreRegion, verifactuActivoEnEmpresa, verifactuDisponible } from './geo-empresa';

describe('geoParaGuardar', () => {
  it('España guarda `ca`', () => {
    expect(geoParaGuardar('ES', 'madrid')).toEqual({ ca: 'madrid', region: undefined });
  });
  it('el resto guarda `region`', () => {
    expect(geoParaGuardar('CO', 'CO-ANT')).toEqual({ region: 'CO-ANT', ca: undefined });
  });
  it('permite pasar el centinela de borrado para el campo que no aplica (edición)', () => {
    const borrar = Symbol('deleteField');
    expect(geoParaGuardar('ES', 'madrid', borrar)).toEqual({ ca: 'madrid', region: borrar });
    expect(geoParaGuardar('MX', 'MX-JAL', borrar)).toEqual({ region: 'MX-JAL', ca: borrar });
  });
});

describe('nombreRegion', () => {
  it('nombre legible de la región del país', () => {
    expect(nombreRegion('ES', 'madrid')).toBe('Comunidad de Madrid');
    expect(nombreRegion('CO', 'CO-DC')).toBe('Bogotá D.C.');
  });
  it('vacío si no hay región o no existe', () => {
    expect(nombreRegion('CO', undefined)).toBe('');
    expect(nombreRegion('CO', 'madrid')).toBe('');
  });
});

describe('verifactuDisponible', () => {
  it('solo en España', () => {
    expect(verifactuDisponible('ES')).toBe(true);
    expect(verifactuDisponible('CO')).toBe(false);
    expect(verifactuDisponible('MX')).toBe(false);
  });
});

describe('verifactuActivoEnEmpresa', () => {
  it('España (o sin país) con Verifactu activado', () => {
    expect(verifactuActivoEnEmpresa({ pais: 'ES', verifactu: { enabled: true } })).toBe(true);
    expect(verifactuActivoEnEmpresa({ verifactu: { enabled: true } })).toBe(true);
  });
  it('desactivado, ausente o sin empresa', () => {
    expect(verifactuActivoEnEmpresa({ pais: 'ES', verifactu: { enabled: false } })).toBe(false);
    expect(verifactuActivoEnEmpresa({ pais: 'ES' })).toBe(false);
    expect(verifactuActivoEnEmpresa(null)).toBe(false);
  });
  it('fuera de España nunca, aunque el flag esté activo', () => {
    expect(verifactuActivoEnEmpresa({ pais: 'MX', verifactu: { enabled: true } })).toBe(false);
  });
});
