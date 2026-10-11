import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { validarIdFiscal } from './id-fiscal';
import { nifValidator } from './nif.validator';

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

describe('validarIdFiscal', () => {
  it('ES aplica el dígito de control español', () => {
    const letra = LETRAS_DNI[12345678 % 23];
    expect(validarIdFiscal('ES', `12345678${letra}`)).toEqual({ ok: true });
    const mala = letra === 'A' ? 'B' : 'A';
    expect(validarIdFiscal('ES', `12345678${mala}`)).toEqual({ ok: false, motivo: 'control' });
    expect(validarIdFiscal('ES', 'PAA123456')).toEqual({ ok: false, motivo: 'formato' });
  });

  it('vacío es válido en todos los países (la obligatoriedad se decide aparte)', () => {
    for (const p of ['ES', 'MX', 'CO', 'CL'] as const) expect(validarIdFiscal(p, '  ').ok).toBe(true);
  });

  it('fuera de España comprueba solo la forma del catálogo', () => {
    expect(validarIdFiscal('CO', '900123456-7').ok).toBe(true);
    expect(validarIdFiscal('CO', 'ABC').ok).toBe(false);
    expect(validarIdFiscal('CL', '12.345.678-5').ok).toBe(true);
    expect(validarIdFiscal('MX', 'XAXX010101000').ok).toBe(true);
    expect(validarIdFiscal('MX', '123').ok).toBe(false);
  });

  it('un NIF español válido no pasa por sí solo la regla de otro país', () => {
    const letra = LETRAS_DNI[12345678 % 23];
    expect(validarIdFiscal('MX', `12345678${letra}`).ok).toBe(false);
  });
});

describe('nifValidator con país', () => {
  it('sin país (por defecto) se comporta como España', () => {
    expect(nifValidator(() => 'nif')(new FormControl('PAA123456'))).toEqual({ nif: 'formato' });
  });

  it('en Colombia valida la forma del NIT y no el dígito español', () => {
    const v = nifValidator(() => 'nif', () => 'CO');
    expect(v(new FormControl('900123456-7'))).toBeNull();
    expect(v(new FormControl('ABC'))).toEqual({ nif: 'formato' });
  });

  it('documento extranjero no se valida en ningún país', () => {
    expect(nifValidator(() => 'extranjero', () => 'CO')(new FormControl('ABC'))).toBeNull();
  });
});
