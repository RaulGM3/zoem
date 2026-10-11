import { describe, it, expect } from 'vitest';
import {
  CAUSAS_EXENCION,
  CAUSA_EXENCION_LABELS,
  desglosarIva,
  esLineaExenta,
  ivaLineaNueva,
  ivaPorDefecto,
  opcionesIva,
  tiposIva,
} from './iva';

describe('tiposIva / ivaPorDefecto / ivaLineaNueva (por país)', () => {
  it.each([
    ['ES', [21, 10, 4, 0], 21],
    ['MX', [16, 8, 0], 16],
    ['CO', [19, 5, 0], 19],
    ['CL', [19, 0], 19],
  ] as const)('%s', (pais, tipos, general) => {
    expect([...tiposIva(pais)]).toEqual(tipos);
    expect(ivaPorDefecto(pais)).toBe(general);
  });

  it('la línea nueva en España sigue naciendo al 10 % (comportamiento histórico)', () => {
    expect(ivaLineaNueva('ES')).toBe(0.1);
  });

  it('fuera de España la línea nueva nace al tipo general del país (fracción)', () => {
    expect(ivaLineaNueva('MX')).toBe(0.16);
    expect(ivaLineaNueva('CO')).toBe(0.19);
    expect(ivaLineaNueva('CL')).toBe(0.19);
  });

  it('el tipo de línea nueva siempre es seleccionable en su país', () => {
    for (const p of ['ES', 'MX', 'CO', 'CL'] as const) {
      expect(tiposIva(p)).toContain(Math.round(ivaLineaNueva(p) * 100));
    }
  });
});

describe('opcionesIva', () => {
  it('sin tipos extra devuelve los tipos vigentes del país', () => {
    expect(opcionesIva('ES', [])).toEqual([21, 10, 4, 0]);
    expect(opcionesIva('MX', [])).toEqual([16, 8, 0]);
  });

  it('ignora los extra que ya son tipos vigentes o vienen vacíos', () => {
    expect(opcionesIva('ES', [21, 0, null, undefined])).toEqual([21, 10, 4, 0]);
  });

  it('conserva un tipo heredado fuera de lista, ordenado de mayor a menor', () => {
    expect(opcionesIva('ES', [7])).toEqual([21, 10, 7, 4, 0]);
  });

  it('redondea el ruido de coma flotante y no duplica', () => {
    // 0.07 * 100 === 7.000000000000001
    expect(opcionesIva('ES', [0.07 * 100, 7])).toEqual([21, 10, 7, 4, 0]);
  });

  it('un documento con tipo español (21 %) sigue siendo seleccionable en una empresa de México', () => {
    expect(opcionesIva('MX', [21])).toEqual([21, 16, 8, 0]);
  });
});

describe('desglosarIva', () => {
  it('desglosa un total con IVA al 21% en base y cuota', () => {
    // 121 € total @ 21% → base 100, cuota 21
    expect(desglosarIva(121, 21, false)).toEqual({ baseImponible: 100, cuotaIva: 21 });
  });

  it('desglosa al 10%', () => {
    // 110 € @ 10% → base 100, cuota 10
    expect(desglosarIva(110, 10, false)).toEqual({ baseImponible: 100, cuotaIva: 10 });
  });

  it('desglosa al 4%', () => {
    // 104 € @ 4% → base 100, cuota 4
    expect(desglosarIva(104, 4, false)).toEqual({ baseImponible: 100, cuotaIva: 4 });
  });

  it('trata un suplido exento como base completa sin cuota', () => {
    expect(desglosarIva(50, 0, true)).toEqual({ baseImponible: 50, cuotaIva: 0 });
  });

  it('tipo 0 (no sujeto) tampoco genera cuota', () => {
    expect(desglosarIva(50, 0, false)).toEqual({ baseImponible: 50, cuotaIva: 0 });
  });

  it('redondea base y cuota a 2 decimales y conserva el total', () => {
    // 100 € @ 21% → base 82.64, cuota 17.36 (suma exacta = 100)
    const { baseImponible, cuotaIva } = desglosarIva(100, 21, false);
    expect(baseImponible).toBe(82.64);
    expect(cuotaIva).toBe(17.36);
    expect(baseImponible + cuotaIva).toBe(100);
  });

  it('desglosa con tipos de otros países (México 16 %)', () => {
    const { baseImponible, cuotaIva } = desglosarIva(116, 16, false);
    expect(baseImponible).toBe(100);
    expect(cuotaIva).toBe(16);
  });
});

describe('causas de exención (R10.2)', () => {
  it('ofrece E1-E6 y N1-N2, en ese orden', () => {
    expect([...CAUSAS_EXENCION]).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'N1', 'N2']);
  });

  it('cada causa tiene una etiqueta descriptiva que empieza por su código', () => {
    for (const c of CAUSAS_EXENCION) {
      expect(CAUSA_EXENCION_LABELS[c].startsWith(`${c} · `)).toBe(true);
      expect(CAUSA_EXENCION_LABELS[c].length).toBeGreaterThan(8);
    }
    expect(CAUSA_EXENCION_LABELS.N2).toContain('localización');
  });
});

describe('esLineaExenta (espejo de functions/src/aeat/desglose.ts)', () => {
  it('línea sin IVA es exenta aunque el global sea 21', () => {
    expect(esLineaExenta({ aplicaIva: false }, 0.21)).toBe(true);
  });

  it('línea con IVA y tipo propio 0 es exenta', () => {
    expect(esLineaExenta({ aplicaIva: true, ivaRate: 0 }, 0.21)).toBe(true);
  });

  it('línea con IVA sin tipo propio hereda el global: 0 exenta, 21 no', () => {
    expect(esLineaExenta({ aplicaIva: true }, 0)).toBe(true);
    expect(esLineaExenta({ aplicaIva: true }, 0.21)).toBe(false);
  });

  it('un tipo propio no exento gana al global exento', () => {
    expect(esLineaExenta({ aplicaIva: true, ivaRate: 0.1 }, 0)).toBe(false);
  });
});
