import { describe, it, expect } from 'vitest';
import { resumen303, type FacturaParaResumen } from './resumen303';

const f = (over: Partial<FacturaParaResumen> = {}): FacturaParaResumen => ({
  estado: 'registrada',
  periodo303: { ejercicio: 2026, trimestre: 2 },
  lineasIva: [{ base: 100, tipo: 21, cuota: 21 }],
  porcentajeDeducible: 100,
  ...over,
});

describe('resumen303', () => {
  it('cuota 21 al 50 % deduce 10.50', () => {
    const r = resumen303([f({ porcentajeDeducible: 50 })], { ejercicio: 2026, trimestre: 2 });
    expect(r.totalCuota).toBe(21);
    expect(r.totalDeducible).toBe(10.5);
    expect(r.numFacturas).toBe(1);
  });

  it('excluye las anuladas', () => {
    const r = resumen303([f(), f({ estado: 'anulada' })], { ejercicio: 2026, trimestre: 2 });
    expect(r.numFacturas).toBe(1);
    expect(r.totalCuota).toBe(21);
  });

  it('solo cuenta el periodo pedido (override incluido)', () => {
    const r = resumen303(
      [f(), f({ periodo303: { ejercicio: 2026, trimestre: 1 } }), f({ periodo303: { ejercicio: 2025, trimestre: 2 } })],
      { ejercicio: 2026, trimestre: 1 },
    );
    expect(r.numFacturas).toBe(1);
  });

  it('agrupa por tipo, de mayor a menor, sumando varias facturas', () => {
    const r = resumen303(
      [
        f({ lineasIva: [{ base: 100, tipo: 21, cuota: 21 }, { base: 50, tipo: 10, cuota: 5 }] }),
        f({ lineasIva: [{ base: 200, tipo: 21, cuota: 42 }] }),
      ],
      { ejercicio: 2026, trimestre: 2 },
    );
    expect(r.porTipo).toEqual([
      { tipo: 21, base: 300, cuota: 63, cuotaDeducible: 63 },
      { tipo: 10, base: 50, cuota: 5, cuotaDeducible: 5 },
    ]);
    expect(r.totalBase).toBe(350);
    expect(r.totalCuota).toBe(68);
    expect(r.totalDeducible).toBe(68);
  });

  it('redondea la cuota deducible por línea a 2 decimales', () => {
    const r = resumen303([f({ lineasIva: [{ base: 33.33, tipo: 21, cuota: 7 }], porcentajeDeducible: 33 })], { ejercicio: 2026, trimestre: 2 });
    expect(r.totalDeducible).toBe(2.31);
  });

  it('trimestre vacío devuelve ceros', () => {
    expect(resumen303([], { ejercicio: 2026, trimestre: 4 })).toEqual({
      porTipo: [],
      totalBase: 0,
      totalCuota: 0,
      totalDeducible: 0,
      numFacturas: 0,
    });
  });
});
