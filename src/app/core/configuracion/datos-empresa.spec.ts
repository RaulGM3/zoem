import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { cifValidator, codigoPostalValidator, normalizarDatosEmpresa } from './datos-empresa';

const base = {
  tipoPersona: 'juridica' as const, name: '  Acme SL ', cif: ' b12345678 ', email: ' a@b.com ',
  telefono: ' ', direccion: ' Calle 1 ', codigoPostal: '28001 ', ciudad: '', website: ' acme.com ',
};

describe('normalizarDatosEmpresa', () => {
  it('trim, vacío -> undefined, CIF en mayúsculas, website con https', () => {
    expect(normalizarDatosEmpresa(base)).toEqual({
      tipoPersona: 'juridica', name: 'Acme SL', cif: 'B12345678', email: 'a@b.com',
      telefono: undefined, direccion: 'Calle 1', codigoPostal: '28001', ciudad: undefined,
      website: 'https://acme.com',
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
