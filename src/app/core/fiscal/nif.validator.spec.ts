import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { nifValidator } from './nif.validator';

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

describe('nifValidator', () => {
  const esNif = () => 'nif' as const;

  it('valor vacío es válido (el requerido se gestiona aparte)', () => {
    expect(nifValidator(esNif)(new FormControl(''))).toBeNull();
    expect(nifValidator(esNif)(new FormControl('   '))).toBeNull();
    expect(nifValidator(esNif)(new FormControl(null))).toBeNull();
  });

  it('NIF válido -> null', () => {
    const letra = LETRAS_DNI[12345678 % 23];
    expect(nifValidator(esNif)(new FormControl(`12345678${letra}`))).toBeNull();
  });

  it('letra de control equivocada -> {nif: "control"}', () => {
    const mala = LETRAS_DNI[12345678 % 23] === 'A' ? 'B' : 'A';
    expect(nifValidator(esNif)(new FormControl(`12345678${mala}`))).toEqual({ nif: 'control' });
  });

  it('formato incorrecto -> {nif: "formato"}', () => {
    expect(nifValidator(esNif)(new FormControl('PAA123456'))).toEqual({ nif: 'formato' });
  });

  it('con tipo distinto de nif no valida (documento extranjero)', () => {
    expect(nifValidator(() => 'extranjero')(new FormControl('PAA123456'))).toBeNull();
  });

  it('lee el tipo en cada validación', () => {
    let tipo: 'nif' | 'extranjero' = 'extranjero';
    const v = nifValidator(() => tipo);
    const c = new FormControl('PAA123456');
    expect(v(c)).toBeNull();
    tipo = 'nif';
    expect(v(c)).toEqual({ nif: 'formato' });
  });
});
