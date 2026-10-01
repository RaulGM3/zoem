import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { buildRegistroAlta, buildRegistroAnulacion } from './buildRegistro';
import { SISTEMA_INFORMATICO, numeroInstalacion, ID_VERSION } from './config';
import type { ChainLink, CompanyDoc, InvoiceDoc, InvoiceLineaDoc } from './types';

// 2026-03-15T10:20:30Z = 11:20:30+01:00 (Madrid, invierno)
const AHORA = new Date('2026-03-15T10:20:30Z');
const AHORA_HUSO = '2026-03-15T11:20:30+01:00';

function sha(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex').toUpperCase();
}

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

const ANTERIOR: ChainLink = {
  idEmisor: 'B76543210',
  numSerie: 'F-2026-000',
  fecha: '14-03-2026',
  huella: 'A'.repeat(64),
  fechaHoraHuso: '2026-03-14T09:00:00+01:00',
};

describe('buildRegistroAlta F1', () => {
  it('S3.6 el destinatario lleva el NIF normalizado (mayúsculas, sin espacios, sin prefijo ES)', () => {
    const sucio = buildRegistroAlta({
      invoice: factura({ clienteNif: ' es b-12.345.674 ' }),
      company: empresa(),
      anterior: null,
      ahora: AHORA,
      rechazoPrevio: false,
    });
    expect(sucio.destinatario).toEqual({ nombreRazon: 'Cliente SL', nif: 'B12345674' });
    const dni = buildRegistroAlta({
      invoice: factura({ clienteNif: '12345678z' }),
      company: empresa(),
      anterior: null,
      ahora: AHORA,
      rechazoPrevio: false,
    });
    expect(dni.destinatario).toEqual({ nombreRazon: 'Cliente SL', nif: '12345678Z' });
  });

  it('S3.1 F1 con destinatario, desglose, totales y datos de identificación', () => {
    const r = buildRegistroAlta({ invoice: factura(), company: empresa(), anterior: null, ahora: AHORA, rechazoPrevio: false });
    expect(r.tipo).toBe('alta');
    expect(r.idVersion).toBe(ID_VERSION);
    expect(r.idFactura).toEqual({ idEmisor: 'B76543210', numSerie: 'F-2026-001', fecha: '15-03-2026' });
    expect(r.nombreRazonEmisor).toBe('Despacho SL');
    expect(r.tipoFactura).toBe('F1');
    expect(r.destinatario).toEqual({ nombreRazon: 'Cliente SL', nif: 'B12345674' });
    expect(r.desglose).toHaveLength(1);
    expect(r.desglose[0]).toMatchObject({ calificacionOperacion: 'S1', tipoImpositivo: '21.00', baseImponible: '100.00', cuotaRepercutida: '21.00' });
    expect(r.cuotaTotal).toBe('21.00');
    expect(r.importeTotal).toBe('121.00');
    expect(r.fechaHoraHusoGenRegistro).toBe(AHORA_HUSO);
    expect(r.tipoHuella).toBe('01');
    expect(r.tipoRectificativa).toBeUndefined();
    expect(r.facturasRectificadas).toBeUndefined();
  });

  it('SistemaInformatico sale de la constante de config con NumeroInstalacion por empresa', () => {
    const r = buildRegistroAlta({ invoice: factura(), company: empresa(), anterior: null, ahora: AHORA, rechazoPrevio: false });
    expect(r.sistemaInformatico).toEqual({ ...SISTEMA_INFORMATICO, numeroInstalacion: numeroInstalacion('co1') });
  });

  it('primer registro: PrimerRegistro y huella con Huella= vacío', () => {
    const r = buildRegistroAlta({ invoice: factura(), company: empresa(), anterior: null, ahora: AHORA, rechazoPrevio: false });
    expect(r.encadenamiento).toEqual({ primerRegistro: true });
    const esperada = sha(
      `IDEmisorFactura=B76543210&NumSerieFactura=F-2026-001&FechaExpedicionFactura=15-03-2026&TipoFactura=F1&CuotaTotal=21.00&ImporteTotal=121.00&Huella=&FechaHoraHusoGenRegistro=${AHORA_HUSO}`,
    );
    expect(r.huella).toBe(esperada);
  });

  it('con anterior: RegistroAnterior y huella encadenada (calculada dentro del builder)', () => {
    const r = buildRegistroAlta({ invoice: factura(), company: empresa(), anterior: ANTERIOR, ahora: AHORA, rechazoPrevio: false });
    expect(r.encadenamiento).toEqual({ primerRegistro: false, anterior: ANTERIOR });
    const esperada = sha(
      `IDEmisorFactura=B76543210&NumSerieFactura=F-2026-001&FechaExpedicionFactura=15-03-2026&TipoFactura=F1&CuotaTotal=21.00&ImporteTotal=121.00&Huella=${'A'.repeat(64)}&FechaHoraHusoGenRegistro=${AHORA_HUSO}`,
    );
    expect(r.huella).toBe(esperada);
  });

  it('S4.4 sin rechazo previo no lleva Subsanacion ni RechazoPrevio', () => {
    const r = buildRegistroAlta({ invoice: factura(), company: empresa(), anterior: null, ahora: AHORA, rechazoPrevio: false });
    expect(r.subsanacion).toBeUndefined();
    expect(r.rechazoPrevio).toBeUndefined();
  });

  it('R7.11 alta por rechazo: Subsanacion=S y RechazoPrevio=X', () => {
    const r = buildRegistroAlta({ invoice: factura(), company: empresa(), anterior: ANTERIOR, ahora: AHORA, rechazoPrevio: true });
    expect(r.subsanacion).toBe('S');
    expect(r.rechazoPrevio).toBe('X');
  });

  it('DescripcionOperacion no vacía y limitada a 500', () => {
    const larga = 'x'.repeat(800);
    const r = buildRegistroAlta({
      invoice: factura({ lineas: [linea({ concepto: larga })] }),
      company: empresa(),
      anterior: null,
      ahora: AHORA,
      rechazoPrevio: false,
    });
    expect(r.descripcionOperacion.length).toBe(500);
    const vacia = buildRegistroAlta({
      invoice: factura({ lineas: [linea({ concepto: '' })] }),
      company: empresa(),
      anterior: null,
      ahora: AHORA,
      rechazoPrevio: false,
    });
    expect(vacia.descripcionOperacion.length).toBeGreaterThan(0);
  });

  it('S3.9 dos líneas exentas con causas distintas -> dos DetalleDesglose', () => {
    const r = buildRegistroAlta({
      invoice: factura({
        lineas: [linea({ aplicaIva: false, causaExencion: 'E1' }), linea({ aplicaIva: false, causaExencion: 'E6' })],
      }),
      company: empresa(),
      anterior: null,
      ahora: AHORA,
      rechazoPrevio: false,
    });
    expect(r.desglose.map((d) => d.operacionExenta)).toEqual(['E1', 'E6']);
    expect(r.cuotaTotal).toBe('0.00');
  });

  it('empresa de impuesto no soportado -> lanza (las precondiciones lo impiden antes)', () => {
    expect(() =>
      buildRegistroAlta({ invoice: factura(), company: empresa({ ca: 'canarias' }), anterior: null, ahora: AHORA, rechazoPrevio: false }),
    ).toThrow();
  });
});

describe('buildRegistroAlta R1 mínima', () => {
  const original = factura({ id: 'orig', invoiceNumber: 'F-2026-000', issueDate: '2026-02-01' });

  it('S3.2 R1: TipoRectificativa I y FacturasRectificadas con la fecha de la original', () => {
    const r = buildRegistroAlta({
      invoice: factura({ tipoFactura: 'R1', facturaRectificadaId: 'orig' }),
      company: empresa(),
      original,
      anterior: null,
      ahora: AHORA,
      rechazoPrevio: false,
    });
    expect(r.tipoFactura).toBe('R1');
    expect(r.tipoRectificativa).toBe('I');
    expect(r.facturasRectificadas).toEqual([{ idEmisor: 'B76543210', numSerie: 'F-2026-000', fecha: '01-02-2026' }]);
  });

  it('S3.3 R1 sin original -> lanza', () => {
    expect(() =>
      buildRegistroAlta({
        invoice: factura({ tipoFactura: 'R1' }),
        company: empresa(),
        anterior: null,
        ahora: AHORA,
        rechazoPrevio: false,
      }),
    ).toThrow();
  });

  it('la huella usa TipoFactura=R1', () => {
    const r = buildRegistroAlta({
      invoice: factura({ tipoFactura: 'R1' }),
      company: empresa(),
      original,
      anterior: null,
      ahora: AHORA,
      rechazoPrevio: false,
    });
    expect(r.huella).toBe(
      sha(
        `IDEmisorFactura=B76543210&NumSerieFactura=F-2026-001&FechaExpedicionFactura=15-03-2026&TipoFactura=R1&CuotaTotal=21.00&ImporteTotal=121.00&Huella=&FechaHoraHusoGenRegistro=${AHORA_HUSO}`,
      ),
    );
  });
});

describe('buildRegistroAnulacion', () => {
  it('S7.18 encadena al anterior y calcula la huella de anulación', () => {
    const r = buildRegistroAnulacion({ invoice: factura(), company: empresa(), anterior: ANTERIOR, ahora: AHORA, rechazoPrevio: false });
    expect(r.tipo).toBe('anulacion');
    expect(r.idFactura).toEqual({ idEmisor: 'B76543210', numSerie: 'F-2026-001', fecha: '15-03-2026' });
    expect(r.encadenamiento).toEqual({ primerRegistro: false, anterior: ANTERIOR });
    expect(r.sistemaInformatico).toEqual({ ...SISTEMA_INFORMATICO, numeroInstalacion: numeroInstalacion('co1') });
    expect(r.fechaHoraHusoGenRegistro).toBe(AHORA_HUSO);
    expect(r.tipoHuella).toBe('01');
    expect(r.rechazoPrevio).toBeUndefined();
    expect(r.huella).toBe(
      sha(
        `IDEmisorFacturaAnulada=B76543210&NumSerieFacturaAnulada=F-2026-001&FechaExpedicionFacturaAnulada=15-03-2026&Huella=${'A'.repeat(64)}&FechaHoraHusoGenRegistro=${AHORA_HUSO}`,
      ),
    );
  });

  it('primer registro de la cadena -> PrimerRegistro', () => {
    const r = buildRegistroAnulacion({ invoice: factura(), company: empresa(), anterior: null, ahora: AHORA, rechazoPrevio: false });
    expect(r.encadenamiento).toEqual({ primerRegistro: true });
  });

  it('S7.15 reintento tras Incorrecto: RechazoPrevio=S y sin Subsanacion', () => {
    const r = buildRegistroAnulacion({ invoice: factura(), company: empresa(), anterior: ANTERIOR, ahora: AHORA, rechazoPrevio: true });
    expect(r.rechazoPrevio).toBe('S');
    expect('subsanacion' in r).toBe(false);
  });
});
