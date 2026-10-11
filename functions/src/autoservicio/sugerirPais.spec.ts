import { describe, expect, it } from 'vitest';
import { paisDesdeCabeceras } from './sugerirPais';

describe('paisDesdeCabeceras', () => {
  it('devuelve el país si la cabecera está y está en el catálogo', () => {
    expect(paisDesdeCabeceras({ 'x-appengine-country': 'CO' })).toBe('CO');
    expect(paisDesdeCabeceras({ 'x-appengine-country': 'mx' })).toBe('MX');
    expect(paisDesdeCabeceras({ 'x-appengine-country': ' ES ' })).toBe('ES');
  });
  it('null si la cabecera falta', () => {
    expect(paisDesdeCabeceras({})).toBeNull();
    expect(paisDesdeCabeceras(undefined)).toBeNull();
  });
  it('null si es ZZ (país desconocido)', () => {
    expect(paisDesdeCabeceras({ 'x-appengine-country': 'ZZ' })).toBeNull();
  });
  it('null si el país no está soportado', () => {
    expect(paisDesdeCabeceras({ 'x-appengine-country': 'AR' })).toBeNull();
    expect(paisDesdeCabeceras({ 'x-appengine-country': '' })).toBeNull();
  });
  it('si la cabecera llega repetida (array) usa la primera', () => {
    expect(paisDesdeCabeceras({ 'x-appengine-country': ['CL', 'ES'] })).toBe('CL');
  });
});
