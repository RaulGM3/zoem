import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Storage } from '@angular/fire/storage';
import { InvoicePdfService } from './invoice-pdf.service';
import { CompanyService } from './company.service';
import { CompanyLogoService } from './company-logo.service';
import jsPDF from 'jspdf';
import type { Company } from './company.service';
import type { Invoice } from './invoice.service';
import type { VerifactuEstado } from '../../interfaces/verifactu.interface';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

type ConQr = { generateQrDataUrl: (texto: string) => Promise<string | null> };

/** Lee el contenido del PDF generado (jsPDF sin compresión deja los textos en claro). */
function leer(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(blob, 'latin1');
  });
}

const QR_URL = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B12345678&numserie=F-2026-0001&fecha=01-09-2026&importe=121.00';

function factura(verifactu?: VerifactuEstado, extra: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    companyId: 'c-1',
    invoiceNumber: 'F-2026-0001',
    amount: 100,
    vat: 21,
    total: 121,
    ivaRate: 0.21,
    status: 'pendiente',
    issueDate: '2026-09-01',
    dueDate: '2026-10-01',
    lineas: [{ concepto: 'Honorarios', cantidad: 1, precioUnitario: 100, base: 100, aplicaIva: true }],
    verifactu,
    ...extra,
  };
}

describe('InvoicePdfService — QR Verifactu (D11)', () => {
  let service: InvoicePdfService;
  const company = { id: 'c-1', name: 'Despacho SL', cif: 'B12345678' } as Company;
  let qr: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Storage, useValue: {} },
        { provide: CompanyService, useValue: { activeCompany: () => company } },
        { provide: CompanyLogoService, useValue: { cargarDataUrl: vi.fn(async () => null) } },
      ],
    });
    service = TestBed.inject(InvoicePdfService);
    qr = vi.fn(async () => PNG_1X1);
    (service as unknown as ConQr).generateQrDataUrl = qr as unknown as ConQr['generateQrDataUrl'];
  });

  /** Genera el PDF y devuelve su contenido de texto. */
  const generar = async (inv: Invoice): Promise<string> => leer(await service['buildPdf'](inv, company));

  it.each(['en_cola', 'pendiente', 'enviado', 'error'] as const)(
    'S11.1/S11.2/S11.5: estado %s con qrUrl dibuja el QR con la URL guardada, sin reconstruirla',
    async (estado) => {
      const pdf = await generar(factura({ estado, tipoRegistro: 'alta', qrUrl: QR_URL }));
      expect(qr).toHaveBeenCalledTimes(1);
      expect(qr.mock.calls[0][0]).toBe(QR_URL);
      expect(pdf).toContain('/Subtype /Image');
    },
  );

  it('S11.3: error de precondición sin qrUrl no dibuja QR ni usa una URL de reserva', async () => {
    const pdf = await generar(
      factura({ estado: 'error', tipoRegistro: 'alta', errorKind: 'precondicion', errorMessage: 'Falta NIF' }),
    );
    expect(qr).not.toHaveBeenCalled();
    expect(pdf).not.toContain('/Subtype /Image');
    expect(pdf).not.toContain('VERI*FACTU');
  });

  it('S11.4: sin bloque verifactu (empresa sin Verifactu) no dibuja nada', async () => {
    const pdf = await generar(factura(undefined));
    expect(qr).not.toHaveBeenCalled();
    expect(pdf).not.toContain('VERI*FACTU');
    expect(pdf).not.toContain('CSV');
  });

  it('enviado sin CSV (aceptado por duplicado): QR sí, línea CSV no', async () => {
    const pdf = await generar(factura({ estado: 'enviado', tipoRegistro: 'alta', qrUrl: QR_URL }));
    expect(qr).toHaveBeenCalledTimes(1);
    expect(pdf).toContain('VERI*FACTU');
    expect(pdf).not.toContain('CSV:');
  });

  it('con CSV imprime la línea CSV; pendiente con QR no inventa CSV', async () => {
    const conCsv = await generar(factura({ estado: 'enviado', tipoRegistro: 'alta', qrUrl: QR_URL, csv: 'ABC123' }));
    expect(conCsv).toContain('(CSV: ABC123)');

    const sinCsv = await generar(factura({ estado: 'pendiente', tipoRegistro: 'alta', qrUrl: QR_URL }));
    expect(sinCsv).not.toContain('CSV:');
  });

  it('7.2: el TOTAL impreso es el ImporteTotal del registro (redondeado por grupo), no invoice.total bruto', async () => {
    const lineas = [
      { concepto: 'A', cantidad: 1, precioUnitario: 0.1, base: 0.1, aplicaIva: true, ivaRate: 0.21 },
      { concepto: 'B', cantidad: 1, precioUnitario: 0.1, base: 0.1, aplicaIva: true, ivaRate: 0.04 },
    ];
    const pdf = await generar(factura(undefined, { lineas, amount: 0.2, vat: 0.025, total: 0.235 }));
    // Ficha de totales: cuotas por grupo 0,02 y 0,00; TOTAL 0,22 (no 0,23 / 0,24 del bruto).
    expect(pdf).toMatch(/\(0,22 .\) Tj/);
    expect(pdf).not.toMatch(/\(0,2[34] .\) Tj/);
  });

  it('S7.1: cliente con NIF imprime "NIF: X" y los tipos ausentes se tratan como nif', async () => {
    const conTipo = await generar(
      factura(undefined, { clienteNombre: 'Ana', clienteNif: '12345678Z', clienteTipoId: 'nif' }),
    );
    expect(conTipo).toContain('(NIF: 12345678Z)');
    expect(conTipo).not.toContain('NIF/CIF');
    const legacy = await generar(factura(undefined, { clienteNombre: 'Ana', clienteNif: 'B12345674' }));
    expect(legacy).toContain('(NIF: B12345674)');
    expect(legacy).not.toContain('Doc. identificaci');
  });

  it('S7.2: cliente con documento extranjero imprime "Doc. identificación: X"', async () => {
    const pdf = await generar(
      factura(undefined, { clienteNombre: 'John', clienteNif: 'PAA123456', clienteTipoId: 'extranjero' }),
    );
    expect(pdf).toContain('Doc. identificaci');
    expect(pdf).toContain('PAA123456');
    expect(pdf).not.toContain('(NIF: PAA123456)');
  });
});

describe('InvoicePdfService — logo de empresa', () => {
  const api = jsPDF.API as unknown as Record<string, (...a: unknown[]) => unknown>;
  const LOGO = { path: 'companies/c-1/branding/logo', url: 'https://x/l', contentType: 'image/png' as const, updatedAt: '2026-01-01T00:00:00.000Z' };
  const conLogo = { id: 'c-1', name: 'Despacho SL', cif: 'B12345678', logo: LOGO } as Company;
  const sinLogo = { id: 'c-1', name: 'Despacho SL', cif: 'B12345678' } as Company;
  let cargarDataUrl: ReturnType<typeof vi.fn>;
  let service: InvoicePdfService;

  beforeEach(() => {
    cargarDataUrl = vi.fn(async () => ({ dataUrl: PNG_1X1, format: 'PNG', w: 400, h: 100 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: Storage, useValue: {} },
        { provide: CompanyService, useValue: { activeCompany: () => null } },
        { provide: CompanyLogoService, useValue: { cargarDataUrl } },
      ],
    });
    service = TestBed.inject(InvoicePdfService);
    (service as unknown as ConQr).generateQrDataUrl = (async () => PNG_1X1) as ConQr['generateQrDataUrl'];
  });

  const generar = async (c: Company, inv: Invoice = factura()): Promise<string> =>
    leer(await service['buildPdf'](inv, c));
  /** Posición Y (mm desde arriba) con la que jsPDF escribió el nombre de la empresa. */
  const yNombre = (pdf: string): number => {
    const m = /([\d.]+) ([\d.]+) Td\s*\(Despacho SL\) Tj/.exec(pdf);
    if (!m) throw new Error('nombre no encontrado en el PDF');
    return 297 - Number(m[2]) / (72 / 25.4);
  };
  const imagenes = (pdf: string) => (pdf.match(/\/Subtype \/Image/g) ?? []).length;

  it('con logo: dibuja la imagen en el margen con dimensiones encajadas (400x100px -> 40x10mm)', async () => {
    const add = vi.spyOn(api, 'addImage');
    const pdf = await generar(conLogo);
    expect(cargarDataUrl).toHaveBeenCalledWith(LOGO);
    expect(imagenes(pdf)).toBeGreaterThan(0);
    const [data, fmt, x, y, w, h] = add.mock.calls[0] as unknown[];
    expect(data).toBe(PNG_1X1);
    expect(fmt).toBe('PNG');
    expect([x, y]).toEqual([20, 12]);
    expect(w as number).toBeCloseTo(40);
    expect(h as number).toBeCloseTo(10);
    add.mockRestore();
  });

  it('con logo: el nombre de la empresa queda debajo del logo', async () => {
    const pdf = await generar(conLogo);
    expect(yNombre(pdf)).toBeCloseTo(12 + 10 + 6, 1);
  });

  it('logo con JPEG usa formato JPEG', async () => {
    cargarDataUrl.mockResolvedValue({ dataUrl: PNG_1X1, format: 'JPEG', w: 100, h: 100 });
    const add = vi.spyOn(api, 'addImage');
    // el dataUrl real es PNG: jsPDF puede rechazarlo -> fallback, pero el intento debe usar JPEG
    await generar(conLogo);
    expect(add.mock.calls[0][1]).toBe('JPEG');
    add.mockRestore();
  });

  it('sin logo: no llama al servicio y el layout es el de siempre', async () => {
    const pdf = await generar(sinLogo);
    expect(cargarDataUrl).not.toHaveBeenCalled();
    expect(imagenes(pdf)).toBe(0);
    expect(yNombre(pdf)).toBeCloseTo(22, 1);
  });

  it.each([
    ['devuelve null', () => cargarDataUrl.mockResolvedValue(null)],
    ['lanza', () => cargarDataUrl.mockRejectedValue(new Error('boom'))],
  ])('fallo al cargar el logo (%s): PDF igual que sin logo, solo el QR', async (_n, preparar) => {
    preparar();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const inv = factura({ estado: 'pendiente', tipoRegistro: 'alta', qrUrl: QR_URL });
    const base = imagenes(await generar(sinLogo, inv));
    expect(base).toBeGreaterThan(0); // el QR
    const pdf = await generar(conLogo, inv);
    expect(imagenes(pdf)).toBe(base); // sin imagen extra
    expect(yNombre(pdf)).toBeCloseTo(22, 1);
  });

  it('addImage lanza: el PDF se genera igual con layout original', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const add = vi.spyOn(api, 'addImage').mockImplementationOnce(() => {
      throw new Error('decode');
    });
    const pdf = await generar(conLogo);
    expect(pdf).toContain('%PDF');
    expect(yNombre(pdf)).toBeCloseTo(22, 1);
    add.mockRestore();
  });
});
