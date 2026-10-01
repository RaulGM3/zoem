import { describe, it, expect } from 'vitest';
import { etiquetaDocumentoContacto } from './documento-contacto';
import type { Contact } from '../../interfaces';

const fisica = (nifType?: string) => ({ type: 'persona_fisica', nifType }) as unknown as Contact;
const juridica = (cifType?: string) => ({ type: 'persona_juridica', cifType }) as unknown as Contact;

describe('etiquetaDocumentoContacto', () => {
  it.each([
    [fisica('dni'), 'DNI'],
    [fisica('nie'), 'NIE'],
    [fisica('pasaporte'), 'Pasaporte'],
    [fisica('otro'), 'Otro'],
    [fisica(undefined), 'NIF'],
  ])('persona física %#', (c, esperado) => {
    expect(etiquetaDocumentoContacto(c)).toBe(esperado);
  });

  it.each([
    [juridica('cif'), 'NIF'],
    [juridica(undefined), 'NIF'],
    [juridica('vat'), 'VAT'],
    [juridica('otro'), 'Otro'],
  ])('persona jurídica %#: nunca muestra "CIF"', (c, esperado) => {
    expect(etiquetaDocumentoContacto(c)).toBe(esperado);
  });
});
