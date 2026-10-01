import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  cadenaHuellaAlta,
  cadenaHuellaAnulacion,
  huellaAlta,
  huellaAnulacion,
  sha256Hex,
  type CamposHuellaAlta,
  type CamposHuellaAnulacion,
} from './huella';

// Vectores oficiales de AEAT (Veri-Factu_especificaciones_huella_hash_registros v0.1.2).
// Los digests están pegados como literales: NO se calculan con el código bajo prueba.
const ALTA_1 = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60';
const ALTA_2 = 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97';
const ANULACION = '177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68';

const CADENA_ALTA_1 =
  'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00';
const CADENA_ALTA_2 = `IDEmisorFactura=89890001K&NumSerieFactura=12345679/G34&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=${ALTA_1}&FechaHoraHusoGenRegistro=2024-01-01T19:20:35+01:00`;
const CADENA_ANULACION = `IDEmisorFacturaAnulada=89890001K&NumSerieFacturaAnulada=12345679/G34&FechaExpedicionFacturaAnulada=01-01-2024&Huella=${ALTA_2}&FechaHoraHusoGenRegistro=2024-01-01T19:20:40+01:00`;

const crypto256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex').toUpperCase();

function alta1(over: Partial<CamposHuellaAlta> = {}): CamposHuellaAlta {
  return {
    idEmisor: '89890001K',
    numSerie: '12345678/G33',
    fecha: '01-01-2024',
    tipoFactura: 'F1',
    cuotaTotal: '12.35',
    importeTotal: '123.45',
    huellaAnterior: '',
    fechaHoraHuso: '2024-01-01T19:20:30+01:00',
    ...over,
  };
}

function alta2(over: Partial<CamposHuellaAlta> = {}): CamposHuellaAlta {
  return alta1({
    numSerie: '12345679/G34',
    huellaAnterior: ALTA_1,
    fechaHoraHuso: '2024-01-01T19:20:35+01:00',
    ...over,
  });
}

function anulacion(over: Partial<CamposHuellaAnulacion> = {}): CamposHuellaAnulacion {
  return {
    idEmisor: '89890001K',
    numSerie: '12345679/G34',
    fecha: '01-01-2024',
    huellaAnterior: ALTA_2,
    fechaHoraHuso: '2024-01-01T19:20:40+01:00',
    ...over,
  };
}

describe('sha256Hex', () => {
  it('devuelve 64 hex en mayúsculas y coincide con node:crypto', () => {
    expect(sha256Hex('abc')).toBe('BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD');
    expect(sha256Hex('áñ€')).toBe(crypto256('áñ€'));
  });
});

describe('cadenaHuellaAlta', () => {
  it('S1.1 construye la cadena exacta del primer registro oficial', () => {
    expect(cadenaHuellaAlta(alta1())).toBe(CADENA_ALTA_1);
  });

  it('S1.2 incrusta la huella anterior literal', () => {
    expect(cadenaHuellaAlta(alta2())).toBe(CADENA_ALTA_2);
  });

  it('S1.4 primer registro: Huella vacía entre separadores', () => {
    expect(cadenaHuellaAlta(alta1())).toContain('&Huella=&');
  });

  it('no añade espacios ni separador final', () => {
    const cadena = cadenaHuellaAlta(alta2());
    expect(cadena).not.toMatch(/\s/);
    expect(cadena.endsWith('&')).toBe(false);
  });
});

describe('huellaAlta', () => {
  it('S1.1 vector oficial alta#1', () => {
    expect(huellaAlta(alta1())).toBe(ALTA_1);
  });

  it('S1.1 vector oficial alta#2 (encadenado a alta#1)', () => {
    expect(huellaAlta(alta2())).toBe(ALTA_2);
  });

  it('S1.1 contraste independiente con node:crypto sobre la cadena literal', () => {
    expect(crypto256(CADENA_ALTA_1)).toBe(ALTA_1);
    expect(crypto256(CADENA_ALTA_2)).toBe(ALTA_2);
    expect(huellaAlta(alta1())).toBe(crypto256(CADENA_ALTA_1));
  });

  it('S1.3 formato /^[0-9A-F]{64}$/ y determinismo', () => {
    const h = huellaAlta(alta2());
    expect(h).toMatch(/^[0-9A-F]{64}$/);
    expect(huellaAlta(alta2())).toBe(h);
  });

  it('S1.3 cambiar un solo campo cambia el digest', () => {
    const base = huellaAlta(alta1());
    const variaciones: Partial<CamposHuellaAlta>[] = [
      { idEmisor: '89890001L' },
      { numSerie: '12345678/G34' },
      { fecha: '02-01-2024' },
      { tipoFactura: 'R1' },
      { cuotaTotal: '12.36' },
      { importeTotal: '123.46' },
      { huellaAnterior: ALTA_1 },
      { fechaHoraHuso: '2024-01-01T19:20:31+01:00' },
    ];
    for (const v of variaciones) {
      expect(huellaAlta(alta1(v))).not.toBe(base);
    }
  });
});

describe('cadenaHuellaAnulacion / huellaAnulacion', () => {
  it('S1.5 cadena con claves ...Anulada en el orden R1.4', () => {
    expect(cadenaHuellaAnulacion(anulacion())).toBe(CADENA_ANULACION);
  });

  it('S1.5 vector oficial de anulación', () => {
    expect(huellaAnulacion(anulacion())).toBe(ANULACION);
  });

  it('S1.5 contraste independiente con node:crypto', () => {
    expect(crypto256(CADENA_ANULACION)).toBe(ANULACION);
  });

  it('S1.5 la función de alta no se ve afectada y difiere de la de anulación', () => {
    expect(huellaAlta(alta2())).toBe(ALTA_2);
    expect(huellaAnulacion(anulacion())).not.toBe(huellaAlta(alta2()));
  });

  it('primer registro de cadena: Huella vacía', () => {
    expect(cadenaHuellaAnulacion(anulacion({ huellaAnterior: '' }))).toContain('&Huella=&');
  });

  it('cambiar un campo cambia el digest', () => {
    expect(huellaAnulacion(anulacion({ numSerie: '12345679/G35' }))).not.toBe(ANULACION);
    expect(huellaAnulacion(anulacion({ fechaHoraHuso: '2024-01-01T19:20:41+01:00' }))).not.toBe(ANULACION);
  });
});
