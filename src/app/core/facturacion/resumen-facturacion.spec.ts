import { describe, it, expect } from 'vitest';
import { resumenFacturacion } from './resumen-facturacion';
import type { Invoice } from '../services/invoice.service';
import type { VerifactuEstado } from '../../interfaces/verifactu.interface';

const HOY = '2026-10-15';

let n = 0;
function factura(override: Partial<Invoice> = {}): Invoice {
  n += 1;
  return {
    id: `f-${n}`,
    companyId: 'co',
    invoiceNumber: `2026-${n}`,
    amount: 100,
    vat: 21,
    total: 121,
    status: 'pendiente',
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    ...override,
  };
}

const enviado: VerifactuEstado = { estado: 'enviado', tipoRegistro: 'alta' };
const conError: VerifactuEstado = { estado: 'error', tipoRegistro: 'alta' };

describe('resumenFacturacion', () => {
  it('sin facturas todo es cero', () => {
    const r = resumenFacturacion([], HOY);
    expect(r.verifactuAprobado).toEqual({ total: 0, facturas: 0 });
    expect(r.ivaMes).toBe(0);
    expect(r.ivaTrimestre).toBe(0);
    expect(r.pendienteCobro).toEqual({ total: 0, facturas: 0 });
    expect(r.vencido).toEqual({ total: 0, facturas: 0 });
    expect(r.incidenciasVerifactu).toBe(0);
  });

  it('aprobado por Verifactu: solo facturas del mes con el alta aceptada por la AEAT', () => {
    const r = resumenFacturacion(
      [
        factura({ total: 121, verifactu: enviado }),
        factura({ total: 242, verifactu: { ...enviado, aceptadoConErrores: true } }),
        factura({ total: 1000, verifactu: { estado: 'pendiente', tipoRegistro: 'alta' } }),
        factura({ total: 1000, verifactu: enviado, issueDate: '2026-09-30' }),
        factura({ total: 1000, verifactu: enviado, status: 'anulada' }),
        factura({ total: 1000 }),
      ],
      HOY,
    );
    expect(r.verifactuAprobado).toEqual({ total: 363, facturas: 2 });
  });

  it('IVA del mes y del trimestre: facturas emitidas (ni borradores ni anuladas), rectificativas restan', () => {
    const r = resumenFacturacion(
      [
        factura({ vat: 21 }),
        factura({ vat: 10.5 }),
        factura({ vat: -5.25, tipoFactura: 'R1' }),
        factura({ vat: 99, status: 'borrador' }),
        factura({ vat: 99, status: 'anulada' }),
        factura({ vat: 7, status: 'pagada', issueDate: '2026-10-31' }),
        factura({ vat: 50, issueDate: '2026-11-01' }),
        // Otro trimestre (Q3) no cuenta.
        factura({ vat: 1000, issueDate: '2026-09-30' }),
      ],
      HOY,
    );
    expect(r.ivaMes).toBe(33.25);
    // Q4 = octubre-diciembre: incluye noviembre.
    expect(r.ivaTrimestre).toBe(83.25);
  });

  it('pendiente de cobro y vencido: vencida es una pendiente con el vencimiento pasado', () => {
    const r = resumenFacturacion(
      [
        factura({ total: 100, dueDate: '2026-10-31' }),
        factura({ total: 200, dueDate: '2026-10-14' }),
        factura({ total: 300, status: 'vencida', dueDate: '2026-10-20' }),
        factura({ total: 999, status: 'pagada', dueDate: '2026-01-01' }),
        factura({ total: 999, status: 'borrador', dueDate: '2026-01-01' }),
        factura({ total: 999, status: 'anulada', dueDate: '2026-01-01' }),
        // El día de vencimiento todavía no está vencida.
        factura({ total: 50, dueDate: HOY }),
      ],
      HOY,
    );
    expect(r.pendienteCobro).toEqual({ total: 650, facturas: 4 });
    expect(r.vencido).toEqual({ total: 500, facturas: 2 });
  });

  it('incidencias Verifactu: registros en error (también de anulaciones), de cualquier fecha', () => {
    const r = resumenFacturacion(
      [
        factura({ verifactu: conError, issueDate: '2025-01-01' }),
        factura({ verifactu: enviado }),
        factura({ status: 'anulada', verifactu: { ...enviado, anulacion: { estado: 'error' } } }),
      ],
      HOY,
    );
    expect(r.incidenciasVerifactu).toBe(2);
  });

  it('redondea a céntimos para no arrastrar errores de coma flotante', () => {
    const r = resumenFacturacion([factura({ vat: 0.1 }), factura({ vat: 0.2 })], HOY);
    expect(r.ivaMes).toBe(0.3);
  });
});
