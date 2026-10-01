import { describe, it, expect } from 'vitest';
import { validarPrecondiciones } from './preconditions';
import type { CompanyDoc, InvoiceDoc, InvoiceLineaDoc } from './types';

function linea(over: Partial<InvoiceLineaDoc> = {}): InvoiceLineaDoc {
  return { concepto: 'Honorarios', cantidad: 1, precioUnitario: 100, base: 100, aplicaIva: true, ivaRate: 0.21, ...over };
}

function factura(over: Partial<InvoiceDoc> = {}): InvoiceDoc {
  return {
    id: 'inv1',
    companyId: 'co1',
    invoiceNumber: 'F-2026-001',
    total: 121,
    issueDate: '2026-03-15',
    clienteNombre: 'Cliente SL',
    clienteNif: 'B12345674',
    lineas: [linea()],
    ivaRate: 0.21,
    tipoFactura: 'F1',
    ...over,
  };
}

function empresa(over: Partial<CompanyDoc> = {}): CompanyDoc {
  return { name: 'Despacho SL', cif: 'B76543210', ca: 'madrid', verifactu: { enabled: true, sandbox: true }, ...over };
}

describe('validarPrecondiciones', () => {
  it('factura F1 correcta -> ok', () => {
    expect(validarPrecondiciones(factura(), empresa(), 'alta')).toEqual({ ok: true });
  });

  it('S3.4 sin NIF de cliente -> NIF_CLIENTE y el mensaje menciona NIF', () => {
    const r = validarPrecondiciones(factura({ clienteNif: undefined }), empresa(), 'alta');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.codigo).toBe('NIF_CLIENTE');
      expect(r.mensaje).toContain('NIF');
    }
  });

  it('NIF de cliente solo con espacios -> NIF_CLIENTE', () => {
    const r = validarPrecondiciones(factura({ clienteNif: '   ' }), empresa(), 'alta');
    expect(r).toMatchObject({ ok: false, codigo: 'NIF_CLIENTE' });
  });

  it('S3.5 línea exenta sin causa -> CAUSA_EXENCION nombrando la línea', () => {
    const r = validarPrecondiciones(
      factura({ lineas: [linea({ concepto: 'Tasas judiciales', aplicaIva: false, ivaRate: undefined })] }),
      empresa(),
      'alta',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.codigo).toBe('CAUSA_EXENCION');
      expect(r.mensaje).toContain('Tasas judiciales');
      expect(r.mensaje.toLowerCase()).toContain('exención');
    }
  });

  it('S3.5 línea con tipo 0 sin causa también es exenta -> CAUSA_EXENCION', () => {
    const r = validarPrecondiciones(factura({ lineas: [linea({ ivaRate: 0 })] }), empresa(), 'alta');
    expect(r).toMatchObject({ ok: false, codigo: 'CAUSA_EXENCION' });
  });

  it('S3.10 factura emitida (legacy) con línea exenta sin causa -> falla con mensaje claro', () => {
    const r = validarPrecondiciones(
      factura({
        lineas: [linea({ aplicaIva: false })],
        verifactu: { estado: 'error', tipoRegistro: 'alta' },
      }),
      empresa(),
      'alta',
    );
    expect(r).toMatchObject({ ok: false, codigo: 'CAUSA_EXENCION' });
  });

  it('línea exenta con causa E1 -> ok', () => {
    const r = validarPrecondiciones(
      factura({ lineas: [linea({ aplicaIva: false, causaExencion: 'E1' })] }),
      empresa(),
      'alta',
    );
    expect(r).toEqual({ ok: true });
  });

  it('S3.6 Canarias -> IMPUESTO_NO_SOPORTADO (IGIC)', () => {
    const r = validarPrecondiciones(factura(), empresa({ ca: 'canarias' }), 'alta');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.codigo).toBe('IMPUESTO_NO_SOPORTADO');
      expect(r.mensaje).toContain('IGIC');
    }
  });

  it('S3.7 Ceuta y Melilla -> IMPUESTO_NO_SOPORTADO (IPSI)', () => {
    for (const ca of ['ceuta', 'melilla']) {
      const r = validarPrecondiciones(factura(), empresa({ ca }), 'alta');
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.codigo).toBe('IMPUESTO_NO_SOPORTADO');
        expect(r.mensaje).toContain('IPSI');
      }
    }
  });

  it('S3.3 R1 sin factura original -> R1_SIN_ORIGINAL', () => {
    const r = validarPrecondiciones(factura({ tipoFactura: 'R1', facturaRectificadaId: 'orig' }), empresa(), 'alta');
    expect(r).toMatchObject({ ok: false, codigo: 'R1_SIN_ORIGINAL' });
  });

  it('S3.3 R1 con original de otra empresa -> R1_SIN_ORIGINAL', () => {
    const original = factura({ id: 'orig', companyId: 'otra' });
    const r = validarPrecondiciones(factura({ tipoFactura: 'R1', facturaRectificadaId: 'orig' }), empresa(), 'alta', original);
    expect(r).toMatchObject({ ok: false, codigo: 'R1_SIN_ORIGINAL' });
  });

  it('S3.2 R1 con original de la misma empresa -> ok', () => {
    const original = factura({ id: 'orig' });
    const r = validarPrecondiciones(factura({ tipoFactura: 'R1', facturaRectificadaId: 'orig' }), empresa(), 'alta', original);
    expect(r).toEqual({ ok: true });
  });

  it('empresa sin CIF -> NIF_EMISOR', () => {
    expect(validarPrecondiciones(factura(), empresa({ cif: undefined }), 'alta')).toMatchObject({
      ok: false,
      codigo: 'NIF_EMISOR',
    });
    expect(validarPrecondiciones(factura(), empresa({ cif: '  ' }), 'alta')).toMatchObject({
      ok: false,
      codigo: 'NIF_EMISOR',
    });
  });

  it('S3.8 exactamente 12 grupos de desglose -> ok', () => {
    const lineas = Array.from({ length: 12 }, (_, i) => linea({ ivaRate: (i + 1) / 100 }));
    expect(validarPrecondiciones(factura({ lineas }), empresa(), 'alta')).toEqual({ ok: true });
  });

  it('S3.8 13 grupos de desglose -> MAX_DESGLOSE', () => {
    const lineas = Array.from({ length: 13 }, (_, i) => linea({ ivaRate: (i + 1) / 100 }));
    const r = validarPrecondiciones(factura({ lineas }), empresa(), 'alta');
    expect(r).toMatchObject({ ok: false, codigo: 'MAX_DESGLOSE' });
  });

  it('muchas líneas del mismo grupo no cuentan como grupos distintos', () => {
    const lineas = Array.from({ length: 30 }, () => linea());
    expect(validarPrecondiciones(factura({ lineas }), empresa(), 'alta')).toEqual({ ok: true });
  });

  it('anulación: solo exige NIF emisor (no desglose, no NIF cliente)', () => {
    const f = factura({ clienteNif: undefined, lineas: [linea({ aplicaIva: false })] });
    expect(validarPrecondiciones(f, empresa(), 'anulacion')).toEqual({ ok: true });
    expect(validarPrecondiciones(f, empresa({ cif: '' }), 'anulacion')).toMatchObject({ codigo: 'NIF_EMISOR' });
  });
});
