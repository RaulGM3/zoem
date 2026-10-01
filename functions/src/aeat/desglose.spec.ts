import { describe, it, expect } from 'vitest';
import { calcularDesglose, esLineaExenta, MAX_DESGLOSE } from './desglose';
import type { InvoiceLineaDoc } from './types';

function linea(over: Partial<InvoiceLineaDoc> = {}): InvoiceLineaDoc {
  return {
    concepto: 'Honorarios',
    cantidad: 1,
    precioUnitario: 100,
    base: 100,
    aplicaIva: true,
    ivaRate: 0.21,
    ...over,
  };
}

describe('calcularDesglose - agrupación y redondeo', () => {
  it('S2.1 dos líneas al 21% forman un grupo: base 150.00 cuota 31.50', () => {
    const r = calcularDesglose([linea({ base: 100 }), linea({ base: 50 })], 0.21, '01');
    expect(r.detalles).toEqual([
      {
        impuesto: '01',
        claveRegimen: '01',
        calificacionOperacion: 'S1',
        tipoImpositivo: '21.00',
        baseImponible: '150.00',
        cuotaRepercutida: '31.50',
      },
    ]);
    expect(r.cuotaTotal).toBe('31.50');
    expect(r.importeTotal).toBe('181.50');
  });

  it('S2.2 21% y 10% producen dos grupos; CuotaTotal es la suma', () => {
    const r = calcularDesglose([linea({ base: 100 }), linea({ base: 100, ivaRate: 0.1 })], 0.21, '01');
    expect(r.detalles).toHaveLength(2);
    expect(r.detalles.map((d) => d.tipoImpositivo)).toEqual(['21.00', '10.00']);
    expect(r.detalles.map((d) => d.cuotaRepercutida)).toEqual(['21.00', '10.00']);
    expect(r.cuotaTotal).toBe('31.00');
    expect(r.importeTotal).toBe('231.00');
  });

  it('S2.3 la cuota se redondea por grupo (half away from zero) y se suma ya redondeada', () => {
    const r = calcularDesglose([linea({ base: 10.05 }), linea({ base: 10.05, ivaRate: 0.1 })], 0.21, '01');
    // 10.05 * 21% = 2.1105 -> 2.11 ; 10.05 * 10% = 1.005 -> 1.01
    expect(r.detalles.map((d) => d.cuotaRepercutida)).toEqual(['2.11', '1.01']);
    expect(r.cuotaTotal).toBe('3.12');
    // Distinto de redondear la suma cruda (3.1155 -> 3.12 coincide, pero aquí fijamos el método por grupo)
    expect(r.importeTotal).toBe('23.22');
  });

  it('redondea la base por grupo a 2 decimales', () => {
    const r = calcularDesglose([linea({ base: 33.333 }), linea({ base: 33.333 })], 0.21, '01');
    expect(r.detalles[0].baseImponible).toBe('66.67');
    expect(r.detalles[0].cuotaRepercutida).toBe('14.00');
  });

  it('usa el IVA global cuando la línea no define ivaRate', () => {
    const r = calcularDesglose([linea({ ivaRate: undefined, base: 200 })], 0.1, '01');
    expect(r.detalles[0].tipoImpositivo).toBe('10.00');
    expect(r.detalles[0].cuotaRepercutida).toBe('20.00');
  });

  it('el impuesto es un parámetro, no un literal', () => {
    const r = calcularDesglose([linea()], 0.21, '03');
    expect(r.detalles[0].impuesto).toBe('03');
  });

  it('importes negativos (rectificativas) redondean away from zero', () => {
    const r = calcularDesglose([linea({ base: -10.05, ivaRate: 0.1 })], 0.21, '01');
    expect(r.detalles[0].baseImponible).toBe('-10.05');
    expect(r.detalles[0].cuotaRepercutida).toBe('-1.01');
    expect(r.cuotaTotal).toBe('-1.01');
    expect(r.importeTotal).toBe('-11.06');
  });
});

describe('calcularDesglose - exentas y no sujetas', () => {
  it('S2.4 línea exenta E1: OperacionExenta, sin calificación, tipo ni cuota', () => {
    const r = calcularDesglose([linea({ aplicaIva: false, causaExencion: 'E1', base: 80 })], 0.21, '01');
    expect(r.detalles).toEqual([
      { impuesto: '01', claveRegimen: '01', operacionExenta: 'E1', baseImponible: '80.00' },
    ]);
  });

  it('S2.5 no sujeta N2: CalificacionOperacion=N2 sin tipo ni cuota', () => {
    const r = calcularDesglose([linea({ aplicaIva: false, causaExencion: 'N2', base: 40 })], 0.21, '01');
    expect(r.detalles).toEqual([
      { impuesto: '01', claveRegimen: '01', calificacionOperacion: 'N2', baseImponible: '40.00' },
    ]);
  });

  it('S2.6 / S3.9 dos exentas con causas distintas forman dos grupos; misma causa se agrupa', () => {
    const distintas = calcularDesglose(
      [
        linea({ aplicaIva: false, causaExencion: 'E1', base: 10 }),
        linea({ aplicaIva: false, causaExencion: 'E6', base: 20 }),
      ],
      0.21,
      '01',
    );
    expect(distintas.detalles.map((d) => d.operacionExenta)).toEqual(['E1', 'E6']);

    const iguales = calcularDesglose(
      [
        linea({ aplicaIva: false, causaExencion: 'E1', base: 10 }),
        linea({ aplicaIva: false, causaExencion: 'E1', base: 20 }),
      ],
      0.21,
      '01',
    );
    expect(iguales.detalles).toHaveLength(1);
    expect(iguales.detalles[0].baseImponible).toBe('30.00');
  });

  it('S2.7 factura solo exenta: CuotaTotal 0.00 e ImporteTotal = suma de bases', () => {
    const r = calcularDesglose(
      [
        linea({ aplicaIva: false, causaExencion: 'E1', base: 10.5 }),
        linea({ aplicaIva: false, causaExencion: 'N1', base: 20 }),
      ],
      0.21,
      '01',
    );
    expect(r.cuotaTotal).toBe('0.00');
    expect(r.importeTotal).toBe('30.50');
  });

  it('tasa efectiva 0 con aplicaIva=true también es exenta', () => {
    const r = calcularDesglose([linea({ ivaRate: 0, causaExencion: 'E3', base: 5 })], 0.21, '01');
    expect(r.detalles[0].operacionExenta).toBe('E3');
    expect(r.detalles[0].tipoImpositivo).toBeUndefined();
  });

  it('mezcla gravada + exenta: la exenta no aporta cuota pero sí importe', () => {
    const r = calcularDesglose(
      [linea({ base: 100 }), linea({ aplicaIva: false, causaExencion: 'E1', base: 50 })],
      0.21,
      '01',
    );
    expect(r.detalles).toHaveLength(2);
    expect(r.cuotaTotal).toBe('21.00');
    expect(r.importeTotal).toBe('171.00');
  });

  it('una línea exenta sin causaExencion lanza error (no se adivina causa)', () => {
    expect(() => calcularDesglose([linea({ aplicaIva: false })], 0.21, '01')).toThrow(/causa/i);
  });

  it('una línea gravada ignora una causaExencion residual', () => {
    const r = calcularDesglose([linea({ causaExencion: 'E1' })], 0.21, '01');
    expect(r.detalles[0].calificacionOperacion).toBe('S1');
    expect(r.detalles[0].operacionExenta).toBeUndefined();
  });
});

describe('esLineaExenta', () => {
  it('!aplicaIva es exenta', () => {
    expect(esLineaExenta(linea({ aplicaIva: false }), 0.21)).toBe(true);
  });
  it('tasa efectiva 0 es exenta (propia o global)', () => {
    expect(esLineaExenta(linea({ ivaRate: 0 }), 0.21)).toBe(true);
    expect(esLineaExenta(linea({ ivaRate: undefined }), 0)).toBe(true);
  });
  it('tasa efectiva > 0 no es exenta', () => {
    expect(esLineaExenta(linea({ ivaRate: 0.1 }), 0)).toBe(false);
    expect(esLineaExenta(linea({ ivaRate: undefined }), 0.21)).toBe(false);
  });
});

describe('MAX_DESGLOSE', () => {
  it('vale 12 y calcularDesglose no trunca: 13 grupos distintos devuelven 13 detalles', () => {
    expect(MAX_DESGLOSE).toBe(12);
    const lineas = Array.from({ length: 13 }, (_, i) => linea({ base: 10, ivaRate: (i + 1) / 100 }));
    const r = calcularDesglose(lineas, 0.21, '01');
    expect(r.detalles).toHaveLength(13);
    expect(r.detalles.length > MAX_DESGLOSE).toBe(true);
  });

  it('exactamente 12 grupos no supera el máximo', () => {
    const lineas = Array.from({ length: 12 }, (_, i) => linea({ base: 10, ivaRate: (i + 1) / 100 }));
    expect(calcularDesglose(lineas, 0.21, '01').detalles).toHaveLength(MAX_DESGLOSE);
  });
});
