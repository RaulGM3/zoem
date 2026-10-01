import { describe, it, expect } from 'vitest';
import { totalesRegistro } from './totales-registro';
import type { InvoiceLinea } from '../services/invoice.service';

function linea(base: number, extra: Partial<InvoiceLinea> = {}): InvoiceLinea {
  return { concepto: 'x', cantidad: 1, precioUnitario: base, base, aplicaIva: true, ...extra };
}

describe('totalesRegistro (espejo de calcularDesglose del servidor)', () => {
  it('agrupa por tipo y suma cuotas redondeadas por grupo (S2.1)', () => {
    const t = totalesRegistro([linea(100), linea(50)], 0.21);
    expect(t.grupos).toEqual([{ pct: 21, base: 150, cuota: 31.5 }]);
    expect(t.cuotaTotal).toBe(31.5);
    expect(t.total).toBe(181.5);
  });

  it('redondea la cuota por grupo, no la suma bruta (S2.3)', () => {
    const t = totalesRegistro([linea(10.05, { ivaRate: 0.21 }), linea(10.05, { ivaRate: 0.1 })], 0.21);
    expect(t.grupos.map((g) => g.cuota)).toEqual([2.11, 1.01]);
    expect(t.cuotaTotal).toBe(3.12);
    expect(t.total).toBe(23.22);
  });

  it('el total del registro puede diferir en un céntimo del total bruto sin redondear', () => {
    // bruto: 0,10 + 0,10 + 0,021 + 0,004 = 0,235 ; registro: 0,10+0,02 + 0,10+0,00 = 0,22
    const t = totalesRegistro([linea(0.1, { ivaRate: 0.21 }), linea(0.1, { ivaRate: 0.04 })], 0.21);
    expect(t.total).toBe(0.22);
  });

  it('líneas exentas aportan base sin cuota y no crean grupo de IVA (S2.7)', () => {
    const t = totalesRegistro([linea(80, { ivaRate: 0 }), linea(20, { aplicaIva: false })], 0.21);
    expect(t.grupos).toEqual([]);
    expect(t.baseTotal).toBe(100);
    expect(t.cuotaTotal).toBe(0);
    expect(t.total).toBe(100);
  });

  it('hereda el tipo global cuando la línea no trae uno propio', () => {
    expect(totalesRegistro([linea(100, { ivaRate: undefined })], 0.1).total).toBe(110);
    expect(totalesRegistro([linea(100, { ivaRate: undefined })], 0).total).toBe(100);
  });
});
