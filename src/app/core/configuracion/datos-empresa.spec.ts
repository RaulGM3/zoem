import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { cifValidator, cifValidatorPara, codigoPostalValidator, codigoPostalValidatorPara, normalizarDatosEmpresa } from './datos-empresa';

const base = {
  tipoPersona: 'juridica' as const, name: '  Acme SL ', cif: ' b12345678 ', email: ' a@b.com ',
  telefono: ' ', direccion: ' Calle 1 ', codigoPostal: '28001 ', ciudad: '', website: ' acme.com ', zonaHoraria: 'America/Bogota',
};

describe('normalizarDatosEmpresa', () => {
  it('trim, vacío -> undefined, CIF en mayúsculas, website con https', () => {
    expect(normalizarDatosEmpresa(base)).toEqual({
      tipoPersona: 'juridica', name: 'Acme SL', cif: 'B12345678', email: 'a@b.com',
      telefono: undefined, direccion: 'Calle 1', codigoPostal: '28001', ciudad: undefined,
      website: 'https://acme.com', zonaHoraria: 'America/Bogota',
    });
  });
  it('respeta website que ya trae protocolo', () => {
    expect(normalizarDatosEmpresa({ ...base, website: 'http://acme.com' }).website).toBe('http://acme.com');
  });
});

describe('validators', () => {
  it('codigoPostal: vacío ok, 5 dígitos ok, otro error', () => {
    expect(codigoPostalValidator(new FormControl(''))).toBeNull();
    expect(codigoPostalValidator(new FormControl('28001'))).toBeNull();
    expect(codigoPostalValidator(new FormControl('2800'))).toEqual({ codigoPostal: true });
    expect(codigoPostalValidator(new FormControl('28a01'))).toEqual({ codigoPostal: true });
  });
  it('cif: vacío ok, 9 alfanuméricos ok (case-insens), otro error', () => {
    expect(cifValidator(new FormControl(''))).toBeNull();
    expect(cifValidator(new FormControl('b12345678'))).toBeNull();
    expect(cifValidator(new FormControl('B1234567'))).toEqual({ cif: true });
    expect(cifValidator(new FormControl('B1234-5678'))).toEqual({ cif: true });
  });
});

describe('ubicación en el payload', () => {
  const ub = { placeId: 'ChIJabc', lat: 6.2, lng: -75.5 };
  it('la lleva si hay ciudad y ubicación', () => {
    expect(normalizarDatosEmpresa({ ...base, ciudad: 'Medellín', ubicacion: ub }).ubicacion).toEqual(ub);
  });
  it('null si se pidió quitarla o ya no hay ciudad; ausente si no se informa', () => {
    expect(normalizarDatosEmpresa({ ...base, ciudad: 'Medellín', ubicacion: null }).ubicacion).toBeNull();
    expect(normalizarDatosEmpresa({ ...base, ciudad: ' ', ubicacion: ub }).ubicacion).toBeNull();
    expect('ubicacion' in normalizarDatosEmpresa(base)).toBe(false);
  });
});

describe('validators por país', () => {
  const cp = (pais: 'ES' | 'CO' | 'CL' | 'MX', v: string) => codigoPostalValidatorPara(() => pais)(new FormControl(v));
  const id = (pais: 'ES' | 'CO' | 'CL' | 'MX', v: string) => cifValidatorPara(() => pais)(new FormControl(v));

  it('código postal: ES y MX 5 dígitos, CO 6, CL 7; vacío siempre ok', () => {
    expect(cp('ES', '28001')).toBeNull();
    expect(cp('MX', '06600')).toBeNull();
    expect(cp('MX', '066000')).toEqual({ codigoPostal: true });
    expect(cp('CO', '050001')).toBeNull();
    expect(cp('CO', '05000')).toEqual({ codigoPostal: true });
    expect(cp('CL', '8320000')).toBeNull();
    expect(cp('CL', '83200')).toEqual({ codigoPostal: true });
    expect(cp('CL', '83200a0')).toEqual({ codigoPostal: true });
    for (const p of ['ES', 'CO', 'CL', 'MX'] as const) expect(cp(p, '')).toBeNull();
  });

  it('id fiscal: comprobación básica de forma por país', () => {
    expect(id('ES', 'B12345678')).toBeNull();
    expect(id('ES', 'B1234567')).toEqual({ cif: true });
    expect(id('CO', '900123456-7')).toBeNull();
    expect(id('CO', '900123456')).toBeNull();
    expect(id('CO', '12')).toEqual({ cif: true });
    expect(id('CL', '12.345.678-5')).toBeNull();
    expect(id('CL', '76543210-K')).toBeNull();
    expect(id('CL', 'abc')).toEqual({ cif: true });
    expect(id('MX', 'XAXX010101000')).toBeNull();
    expect(id('MX', 'xaxx010101000')).toBeNull();
    expect(id('MX', 'XAXX0101')).toEqual({ cif: true });
    for (const p of ['ES', 'CO', 'CL', 'MX'] as const) expect(id(p, '')).toBeNull();
  });

  it('los validators sin país siguen siendo los de España', () => {
    expect(codigoPostalValidator(new FormControl('050001'))).toEqual({ codigoPostal: true });
    expect(cifValidator(new FormControl('900123456-7'))).toEqual({ cif: true });
  });
});
