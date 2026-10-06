import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Storage } from '@angular/fire/storage';
import { InvoiceService, InvoiceLinea, Invoice } from './invoice.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { CompanyLogoService } from './company-logo.service';
import { CompanyService, Company } from './company.service';
import type { ClienteFactura } from '../facturacion/cliente-factura';

// ────────────────────────────────────────────────────
// vi.hoisted: variables accesibles DENTRO de vi.mock (hoisting seguro)
// ────────────────────────────────────────────────────

const { mockAddDoc, mockGetDocs, mockUpdateDoc, mockGetDoc, mockCallable, mockHttpsCallable } = vi.hoisted(() => {
  const callable = vi.fn();
  return {
    mockAddDoc: vi.fn().mockResolvedValue({ id: 'invoice-123' }),
    mockGetDocs: vi.fn().mockResolvedValue({ docs: [] }),
    mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
    mockGetDoc: vi.fn().mockResolvedValue({ exists: () => false }),
    mockCallable: callable,
    mockHttpsCallable: vi.fn().mockReturnValue(callable),
  };
});

vi.mock('@angular/fire/firestore', () => ({
  // Token de inyección — Angular usa la clase como token
  Firestore: class MockFirestore {},
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: () => '__serverTimestamp__',
  collection: vi.fn().mockReturnValue('mock-collection-ref'),
  doc: vi.fn().mockReturnValue('mock-doc-ref'),
  query: vi.fn().mockReturnValue('mock-query'),
  where: vi.fn().mockReturnValue('mock-where'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  deleteField: () => '__deleteField__',
}));

vi.mock('@angular/fire/functions', () => ({
  Functions: class {},
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

function makeCompany(override: { id?: string; nif?: string; verifactuEnabled?: boolean } = {}): Company {
  const { id = 'company-abc', nif, verifactuEnabled = false } = override;
  return {
    id,
    name: 'Test SL',
    slug: 'test-sl',
    isActive: true,
    cif: nif,
    verifactu: verifactuEnabled ? { enabled: true, sandbox: true } : undefined,
  };
}

function buildCompanyService(override: Parameters<typeof makeCompany>[0] = {}): Partial<CompanyService> {
  return { activeCompany: signal<Company | null>(makeCompany(override)) };
}

const RESPUESTA_EN_COLA = { sent: false, estado: 'en_cola' as const };

function resetCallable(): void {
  mockCallable.mockReset();
  mockCallable.mockResolvedValue({ data: RESPUESTA_EN_COLA });
  mockHttpsCallable.mockReset();
  mockHttpsCallable.mockReturnValue(mockCallable);
  mockGetDoc.mockReset();
  mockGetDoc.mockResolvedValue({ exists: () => false });
}

function setupService(
  companyOverride: Parameters<typeof buildCompanyService>[0] = {},
): { svc: InvoiceService; generateAndUpload: ReturnType<typeof vi.fn> } {
  const generateAndUpload = vi.fn().mockResolvedValue('https://pdf.test/x.pdf');
  TestBed.configureTestingModule({
    providers: [
      InvoiceService,
      { provide: Firestore, useValue: {} },
      { provide: Functions, useValue: {} },
      { provide: Storage, useValue: {} },
      { provide: CompanyService, useValue: buildCompanyService(companyOverride) },
      { provide: InvoicePdfService, useValue: { generateAndUpload } },
    ],
  });
  return { svc: TestBed.inject(InvoiceService), generateAndUpload };
}

/** Todo lo que el cliente escribió en Firestore con `updateDoc` / `addDoc`. */
function escrituras(): Record<string, unknown>[] {
  return [...mockUpdateDoc.mock.calls.map((c) => c[1]), ...mockAddDoc.mock.calls.map((c) => c[1])];
}

function stubGetDoc(invoice: Invoice | null): void {
  mockGetDoc.mockResolvedValue(
    invoice ? { exists: () => true, id: invoice.id, data: () => invoice } : { exists: () => false },
  );
}

function makeInvoiceDoc(override: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    companyId: 'company-abc',
    invoiceNumber: 'F-2026-0007',
    amount: 100,
    vat: 21,
    total: 121,
    status: 'pendiente',
    issueDate: '2026-09-01',
    dueDate: '2026-10-01',
    ...override,
  };
}

// ────────────────────────────────────────────────────
// Tests: nextInvoiceNumber
// ────────────────────────────────────────────────────

describe('InvoiceService.nextInvoiceNumber()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCallable();
    TestBed.resetTestingModule();
  });

  it('sin facturas previas → F-YEAR-0001', () => {
    const { svc } = setupService();
    const year = new Date().getFullYear();
    expect(svc.nextInvoiceNumber()).toBe(`F-${year}-0001`);
  });

  it('con facturas del año actual → incrementa el máximo', () => {
    const { svc } = setupService();
    const year = new Date().getFullYear();
    svc.invoices.set([
      { id: '1', companyId: 'x', invoiceNumber: `F-${year}-0003`, amount: 100, vat: 21, total: 121, status: 'pendiente', issueDate: '', dueDate: '' },
      { id: '2', companyId: 'x', invoiceNumber: `F-${year}-0007`, amount: 100, vat: 21, total: 121, status: 'pendiente', issueDate: '', dueDate: '' },
    ]);
    expect(svc.nextInvoiceNumber()).toBe(`F-${year}-0008`);
  });

  it('facturas de año anterior no afectan el contador del año actual', () => {
    const { svc } = setupService();
    const year = new Date().getFullYear();
    svc.invoices.set([
      { id: '1', companyId: 'x', invoiceNumber: `F-${year - 1}-0099`, amount: 100, vat: 21, total: 121, status: 'pendiente', issueDate: '', dueDate: '' },
    ]);
    expect(svc.nextInvoiceNumber()).toBe(`F-${year}-0001`);
  });

  it('número zero-padded a 4 dígitos', () => {
    const { svc } = setupService();
    const year = new Date().getFullYear();
    svc.invoices.set(
      Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        companyId: 'x',
        invoiceNumber: `F-${year}-${String(i + 1).padStart(4, '0')}`,
        amount: 0, vat: 0, total: 0, status: 'pendiente', issueDate: '', dueDate: '',
      }))
    );
    expect(svc.nextInvoiceNumber()).toBe(`F-${year}-0013`);
  });
});

// ────────────────────────────────────────────────────
// Tests: createInvoiceForCaso — cálculo de importes
// ────────────────────────────────────────────────────

describe('InvoiceService.createInvoiceForCaso() — cálculos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCallable();
    TestBed.resetTestingModule();
    mockAddDoc.mockResolvedValue({ id: 'invoice-gen' });
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  const today = new Date().toISOString().slice(0, 10);
  const due30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();

  function linea(overrides: Partial<InvoiceLinea> = {}): InvoiceLinea {
    return { concepto: 'Test', cantidad: 1, precioUnitario: 0, base: 0, aplicaIva: false, ...overrides };
  }

  it('base = suma de todas las líneas, IVA solo en las marcadas', async () => {
    const { svc } = setupService();
    const lineas: InvoiceLinea[] = [
      linea({ concepto: 'Honorarios', cantidad: 1, precioUnitario: 1000, base: 1000, aplicaIva: true }),
      linea({ concepto: 'Suplidos', cantidad: 1, precioUnitario: 200, base: 200, aplicaIva: false }),
    ];

    const id = await svc.createInvoiceForCaso('caso-1', lineas, 0.21, today, due30);

    const [_collRef, invoiceData] = mockAddDoc.mock.calls[0];
    expect(id).toBe('invoice-gen');
    expect(invoiceData.amount).toBe(1200);
    expect(invoiceData.vat).toBeCloseTo(210);
    expect(invoiceData.total).toBeCloseTo(1410);
  });

  it('ninguna línea con IVA → vat = 0', async () => {
    const { svc } = setupService();
    const lineas: InvoiceLinea[] = [
      linea({ concepto: 'Suplidos', cantidad: 1, precioUnitario: 500, base: 500 }),
      linea({ concepto: 'Ingresos', cantidad: 1, precioUnitario: 300, base: 300 }),
    ];

    await svc.createInvoiceForCaso('caso-1', lineas, 0.21, today, due30);

    const [, invoiceData] = mockAddDoc.mock.calls[0];
    expect(invoiceData.vat).toBe(0);
    expect(invoiceData.total).toBe(800);
  });

  it('todas las líneas con IVA → vat = base * rate', async () => {
    const { svc } = setupService();
    const lineas: InvoiceLinea[] = [
      linea({ concepto: 'Honorarios', cantidad: 1, precioUnitario: 2000, base: 2000, aplicaIva: true }),
    ];

    await svc.createInvoiceForCaso('caso-1', lineas, 0.1, today, due30);

    const [, invoiceData] = mockAddDoc.mock.calls[0];
    expect(invoiceData.amount).toBe(2000);
    expect(invoiceData.vat).toBeCloseTo(200);
    expect(invoiceData.total).toBeCloseTo(2200);
  });

  it('per-line IVA rate overrides global rate', async () => {
    const { svc } = setupService();
    const lineas: InvoiceLinea[] = [
      linea({ concepto: 'Servicio al 10%', cantidad: 1, precioUnitario: 1000, base: 1000, aplicaIva: true, ivaRate: 0.10 }),
      linea({ concepto: 'Servicio al 21%', cantidad: 1, precioUnitario: 1000, base: 1000, aplicaIva: true }),
    ];

    await svc.createInvoiceForCaso('caso-1', lineas, 0.21, today, due30);

    const [, invoiceData] = mockAddDoc.mock.calls[0];
    expect(invoiceData.vat).toBeCloseTo(310); // 1000*0.10 + 1000*0.21
  });

  it('guarda casoId en el documento de Firestore', async () => {
    const { svc } = setupService();
    await svc.createInvoiceForCaso('caso-xyz', [linea({ concepto: 'H', base: 100, precioUnitario: 100, aplicaIva: true })], 0.21, today, due30);
    const [, invoiceData] = mockAddDoc.mock.calls[0];
    expect(invoiceData.casoId).toBe('caso-xyz');
  });

  it('status inicial es "pendiente"', async () => {
    const { svc } = setupService();
    await svc.createInvoiceForCaso('caso-1', [linea({ concepto: 'H', base: 500, precioUnitario: 500, aplicaIva: true })], 0.21, today, due30);
    const [, invoiceData] = mockAddDoc.mock.calls[0];
    expect(invoiceData.status).toBe('pendiente');
  });

  it('uses provided issueDate and dueDate', async () => {
    const { svc } = setupService();
    await svc.createInvoiceForCaso('caso-1', [linea({ concepto: 'H', base: 100, precioUnitario: 100, aplicaIva: true })], 0.21, '2026-01-15', '2026-02-14');
    const [, invoiceData] = mockAddDoc.mock.calls[0];
    expect(invoiceData.issueDate).toBe('2026-01-15');
    expect(invoiceData.dueDate).toBe('2026-02-14');
  });

  it('NO llama al callable si la empresa no tiene Verifactu habilitado', async () => {
    const { svc, generateAndUpload } = setupService({ verifactuEnabled: false });
    await svc.createInvoiceForCaso('caso-1', [linea({ concepto: 'H', base: 100, precioUnitario: 100, aplicaIva: true })], 0.21, today, due30);
    await vi.waitFor(() => expect(generateAndUpload).toHaveBeenCalled());
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('con Verifactu habilitado llama al callable con {companyId, invoiceId, tipo:"alta"} (S9.2)', async () => {
    const { svc } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    await svc.createInvoiceForCaso('caso-1', [linea({ concepto: 'H', base: 100, precioUnitario: 100, aplicaIva: true })], 0.21, today, due30);
    await vi.waitFor(() => expect(mockCallable).toHaveBeenCalledTimes(1));
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'verifactuSubmit');
    expect(mockCallable).toHaveBeenCalledWith({ companyId: 'company-abc', invoiceId: 'invoice-gen', tipo: 'alta' });
  });

  it('el cliente NUNCA escribe `verifactu` en la factura (S9.5)', async () => {
    const { svc, generateAndUpload } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    await svc.createInvoiceForCaso('caso-1', [linea({ concepto: 'H', base: 100, precioUnitario: 100, aplicaIva: true })], 0.21, today, due30);
    await vi.waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled()); // pdfUrl
    expect(generateAndUpload).toHaveBeenCalled();
    const todas = escrituras();
    expect(todas.length).toBeGreaterThanOrEqual(2); // addDoc + updateDoc(pdfUrl)
    for (const data of todas) expect(Object.keys(data)).not.toContain('verifactu');
  });

  it('el PDF se genera DESPUÉS de que el callable resuelva y con la factura recargada (con qrUrl) (R11.1)', async () => {
    const orden: string[] = [];
    const recargada = makeInvoiceDoc({
      id: 'invoice-gen',
      verifactu: { estado: 'pendiente', tipoRegistro: 'alta', qrUrl: 'https://qr.test/?nif=B1' },
    });
    mockCallable.mockImplementation(async () => {
      orden.push('callable');
      return { data: { sent: false, estado: 'pendiente' } };
    });
    mockGetDoc.mockImplementation(async () => {
      orden.push('recarga');
      return { exists: () => true, id: 'invoice-gen', data: () => recargada };
    });
    const { svc, generateAndUpload } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    generateAndUpload.mockImplementation(async () => {
      orden.push('pdf');
      return 'https://pdf.test/x.pdf';
    });

    await svc.createInvoiceForCaso('caso-1', [linea({ concepto: 'H', base: 100, precioUnitario: 100, aplicaIva: true })], 0.21, today, due30);
    await vi.waitFor(() => expect(generateAndUpload).toHaveBeenCalledTimes(1));

    expect(orden).toEqual(['callable', 'recarga', 'pdf']);
    const factura = generateAndUpload.mock.calls[0][0] as Invoice;
    expect(factura.verifactu?.qrUrl).toBe('https://qr.test/?nif=B1');
  });

  it('si el callable falla, la factura sigue y el PDF se genera igualmente', async () => {
    mockCallable.mockRejectedValue(new Error('network'));
    const { svc, generateAndUpload } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    const id = await svc.createInvoiceForCaso('caso-1', [linea({ concepto: 'H', base: 100, precioUnitario: 100, aplicaIva: true })], 0.21, today, due30);
    expect(id).toBe('invoice-gen');
    await vi.waitFor(() => expect(generateAndUpload).toHaveBeenCalledTimes(1));
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('lanza si no hay companyId activo', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        InvoiceService,
        { provide: Firestore, useValue: {} },
        { provide: Functions, useValue: {} },
        { provide: Storage, useValue: {} },
        { provide: CompanyService, useValue: { activeCompany: signal<Company | null>(null) } },
        { provide: CompanyLogoService, useValue: { cargarDataUrl: vi.fn() } },
      ],
    });
    const svc = TestBed.inject(InvoiceService);
    await expect(
      svc.createInvoiceForCaso('caso-1', [linea({ concepto: 'H', base: 100, precioUnitario: 100, aplicaIva: true })], 0.21, today, due30)
    ).rejects.toThrow('No active company');
  });
});

// ────────────────────────────────────────────────────
// Tests: updateInvoiceNumber — override manual del número de factura
// ────────────────────────────────────────────────────

describe('InvoiceService.updateInvoiceNumber()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCallable();
    TestBed.resetTestingModule();
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  const makeInvoice = makeInvoiceDoc;
  const stubGetInvoice = stubGetDoc;

  it('actualiza el número cuando la factura no está registrada en Verifactu', async () => {
    const { svc } = setupService();
    stubGetInvoice(makeInvoice());

    await svc.updateInvoiceNumber('inv-1', 'A/2026/000123');

    const [, data] = mockUpdateDoc.mock.calls[0];
    expect(data.invoiceNumber).toBe('A/2026/000123');
    expect(data.numeroManual).toBe(true);
  });

  it('recorta espacios alrededor del número', async () => {
    const { svc } = setupService();
    stubGetInvoice(makeInvoice());

    await svc.updateInvoiceNumber('inv-1', '  A/2026/000123  ');

    const [, data] = mockUpdateDoc.mock.calls[0];
    expect(data.invoiceNumber).toBe('A/2026/000123');
  });

  it('rechaza si la factura ya fue aceptada por Verifactu', async () => {
    const { svc } = setupService();
    stubGetInvoice(makeInvoice({ verifactu: { estado: 'enviado', tipoRegistro: 'alta', huella: 'H' } }));

    await expect(svc.updateInvoiceNumber('inv-1', 'A/2026/000123')).rejects.toThrow(/Verifactu/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it.each(['pendiente', 'en_cola'] as const)('rechaza si el registro Verifactu está %s (R9.4)', async (estado) => {
    const { svc } = setupService();
    stubGetInvoice(makeInvoice({ verifactu: { estado, tipoRegistro: 'alta' } }));

    await expect(svc.updateInvoiceNumber('inv-1', 'A/2026/000123')).rejects.toThrow(/Verifactu/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('permite cambiar el número tras un error de Verifactu (S9.6)', async () => {
    const { svc } = setupService();
    stubGetInvoice(makeInvoice({ verifactu: { estado: 'error', tipoRegistro: 'alta', errorMessage: 'Falta NIF' } }));

    await svc.updateInvoiceNumber('inv-1', 'A/2026/000123');

    expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({ invoiceNumber: 'A/2026/000123', numeroManual: true });
  });

  it('rechaza si la factura está anulada', async () => {
    const { svc } = setupService();
    stubGetInvoice(makeInvoice({ status: 'anulada' }));

    await expect(svc.updateInvoiceNumber('inv-1', 'A/2026/000123')).rejects.toThrow(/anulada/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('rechaza un número vacío', async () => {
    const { svc } = setupService();
    stubGetInvoice(makeInvoice());

    await expect(svc.updateInvoiceNumber('inv-1', '   ')).rejects.toThrow(/vacío/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('rechaza un número ya usado por otra factura', async () => {
    const { svc } = setupService();
    stubGetInvoice(makeInvoice());
    svc.invoices.set([
      makeInvoice(),
      makeInvoice({ id: 'inv-2', invoiceNumber: 'A/2026/000123' }),
    ]);

    await expect(svc.updateInvoiceNumber('inv-1', 'A/2026/000123')).rejects.toThrow(/ya está en uso/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('no escribe nada si el número no cambió', async () => {
    const { svc } = setupService();
    stubGetInvoice(makeInvoice());

    await svc.updateInvoiceNumber('inv-1', 'F-2026-0007');

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('rechaza si la factura no existe', async () => {
    const { svc } = setupService();
    stubGetInvoice(null);

    await expect(svc.updateInvoiceNumber('inv-1', 'A/2026/000123')).rejects.toThrow(/no encontrada/);
  });
});

// ────────────────────────────────────────────────────
// Tests: updateInvoiceContent — bloqueo de edición (R9.4, S9.6)
// ────────────────────────────────────────────────────

describe('InvoiceService.updateInvoiceContent() — bloqueo por Verifactu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCallable();
    TestBed.resetTestingModule();
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  const lineas: InvoiceLinea[] = [
    { concepto: 'H', cantidad: 1, precioUnitario: 100, base: 100, aplicaIva: true },
  ];

  it.each(['pendiente', 'en_cola', 'enviado'] as const)('rechaza editar con registro %s', async (estado) => {
    const { svc } = setupService();
    stubGetDoc(makeInvoiceDoc({ verifactu: { estado, tipoRegistro: 'alta' } }));

    await expect(svc.updateInvoiceContent('inv-1', lineas, 0.21, '2026-09-01', '2026-10-01')).rejects.toThrow(/Verifactu/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('permite editar una factura con error y no toca `verifactu`', async () => {
    const { svc } = setupService();
    stubGetDoc(makeInvoiceDoc({ verifactu: { estado: 'error', tipoRegistro: 'alta', errorMessage: 'Falta NIF' } }));

    await svc.updateInvoiceContent('inv-1', lineas, 0.21, '2026-09-01', '2026-10-01');

    const [, data] = mockUpdateDoc.mock.calls[0];
    expect(data.total).toBeCloseTo(121);
    expect(Object.keys(data)).not.toContain('verifactu');
  });

  it('permite editar una factura sin Verifactu', async () => {
    const { svc } = setupService();
    stubGetDoc(makeInvoiceDoc());

    await svc.updateInvoiceContent('inv-1', lineas, 0.21, '2026-09-01', '2026-10-01');

    expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({ amount: 100, total: expect.closeTo(121) });
  });
});

// ────────────────────────────────────────────────────
// Tests: retryVerifactu — solo callable, sin escrituras de cliente (R9.3)
// ────────────────────────────────────────────────────

describe('InvoiceService.retryVerifactu()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCallable();
    TestBed.resetTestingModule();
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  it.each(['error', 'pendiente', 'en_cola'] as const)('con estado %s llama al callable (alta) y no escribe verifactu (S9.2)', async (estado) => {
    const { svc } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    stubGetDoc(makeInvoiceDoc({ verifactu: { estado, tipoRegistro: 'alta' } }));

    await svc.retryVerifactu('inv-1');

    await vi.waitFor(() => expect(mockCallable).toHaveBeenCalledTimes(1));
    expect(mockCallable).toHaveBeenCalledWith({ companyId: 'company-abc', invoiceId: 'inv-1', tipo: 'alta' });
    for (const data of escrituras()) expect(Object.keys(data)).not.toContain('verifactu');
  });

  it('factura anulada con la anulación en error -> tipo "anulacion"', async () => {
    const { svc } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    stubGetDoc(makeInvoiceDoc({
      status: 'anulada',
      verifactu: { estado: 'enviado', tipoRegistro: 'alta', anulacion: { estado: 'error' } },
    }));

    await svc.retryVerifactu('inv-1');

    await vi.waitFor(() => expect(mockCallable).toHaveBeenCalledTimes(1));
    expect(mockCallable).toHaveBeenCalledWith({ companyId: 'company-abc', invoiceId: 'inv-1', tipo: 'anulacion' });
  });

  it('rechaza si la factura ya está enviada (no hay nada que reintentar)', async () => {
    const { svc } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    stubGetDoc(makeInvoiceDoc({ verifactu: { estado: 'enviado', tipoRegistro: 'alta' } }));

    await expect(svc.retryVerifactu('inv-1')).rejects.toThrow(/reintentar/);
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('rechaza si la empresa no tiene Verifactu habilitado', async () => {
    const { svc } = setupService({ verifactuEnabled: false });
    stubGetDoc(makeInvoiceDoc({ verifactu: { estado: 'error', tipoRegistro: 'alta' } }));

    await expect(svc.retryVerifactu('inv-1')).rejects.toThrow(/no está configurado/);
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('rechaza si la factura no existe', async () => {
    const { svc } = setupService({ verifactuEnabled: true });
    stubGetDoc(null);

    await expect(svc.retryVerifactu('inv-1')).rejects.toThrow(/no encontrada/);
  });

  it('regenera el PDF tras el reenvío del alta (el qrUrl pudo reescribirse) (S11.5)', async () => {
    const { svc, generateAndUpload } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    stubGetDoc(makeInvoiceDoc({ verifactu: { estado: 'error', tipoRegistro: 'alta', qrUrl: 'https://qr.test/x' } }));

    await svc.retryVerifactu('inv-1');

    await vi.waitFor(() => expect(generateAndUpload).toHaveBeenCalledTimes(1));
    expect(mockCallable.mock.invocationCallOrder[0]).toBeLessThan(generateAndUpload.mock.invocationCallOrder[0]);
  });
});

// ────────────────────────────────────────────────────
// Tests: anularFactura / finalizeDraft vía callable
// ────────────────────────────────────────────────────

describe('InvoiceService.anularFactura()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCallable();
    TestBed.resetTestingModule();
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  it('factura enviada: marca anulada y pide la anulación al servidor (tipo "anulacion")', async () => {
    const { svc } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    stubGetDoc(makeInvoiceDoc({ verifactu: { estado: 'enviado', tipoRegistro: 'alta', csv: 'C1' } }));

    await svc.anularFactura('inv-1');

    expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({ status: 'anulada' });
    await vi.waitFor(() => expect(mockCallable).toHaveBeenCalledWith({ companyId: 'company-abc', invoiceId: 'inv-1', tipo: 'anulacion' }));
    for (const data of escrituras()) expect(Object.keys(data)).not.toContain('verifactu');
  });

  it('factura sin registro enviado: solo cambia el estado', async () => {
    const { svc } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    stubGetDoc(makeInvoiceDoc({ verifactu: { estado: 'error', tipoRegistro: 'alta' } }));

    await svc.anularFactura('inv-1');

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('empresa sin Verifactu: no llama al callable', async () => {
    const { svc } = setupService({ verifactuEnabled: false });
    stubGetDoc(makeInvoiceDoc({ verifactu: { estado: 'enviado', tipoRegistro: 'alta' } }));

    await svc.anularFactura('inv-1');

    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('un fallo del callable de anulación no rompe la anulación local', async () => {
    mockCallable.mockRejectedValue(new Error('network'));
    const { svc } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    stubGetDoc(makeInvoiceDoc({ verifactu: { estado: 'enviado', tipoRegistro: 'alta' } }));

    await expect(svc.anularFactura('inv-1')).resolves.toBeUndefined();
    await vi.waitFor(() => expect(mockCallable).toHaveBeenCalledTimes(1));
  });
});

describe('InvoiceService.finalizeDraft()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCallable();
    TestBed.resetTestingModule();
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  it('al finalizar un borrador pide el alta al servidor y luego genera el PDF', async () => {
    const { svc, generateAndUpload } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    stubGetDoc(makeInvoiceDoc({ status: 'borrador' }));

    await svc.finalizeDraft('inv-1');

    await vi.waitFor(() => expect(generateAndUpload).toHaveBeenCalledTimes(1));
    expect(mockCallable).toHaveBeenCalledWith({ companyId: 'company-abc', invoiceId: 'inv-1', tipo: 'alta' });
    expect(mockCallable.mock.invocationCallOrder[0]).toBeLessThan(generateAndUpload.mock.invocationCallOrder[0]);
  });

  it('empresa sin Verifactu: solo PDF', async () => {
    const { svc, generateAndUpload } = setupService({ verifactuEnabled: false });
    stubGetDoc(makeInvoiceDoc({ status: 'borrador' }));

    await svc.finalizeDraft('inv-1');

    await vi.waitFor(() => expect(generateAndUpload).toHaveBeenCalledTimes(1));
    expect(mockCallable).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────
// Tests: cliente de la factura (cliente-factura-nif, R2)
// ────────────────────────────────────────────────────

describe('InvoiceService — cliente de la factura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCallable();
    TestBed.resetTestingModule();
    mockAddDoc.mockResolvedValue({ id: 'invoice-gen' });
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  const hoy = '2026-09-01';
  const vence = '2026-10-01';
  const lineas: InvoiceLinea[] = [{ concepto: 'H', cantidad: 1, precioUnitario: 100, base: 100, aplicaIva: true }];
  const clienteNif: ClienteFactura = {
    contactoId: 'c-1',
    nombre: 'Ana Pérez',
    tipoId: 'nif',
    nif: '12345678Z',
    direccion: 'Calle Mayor 1, Madrid',
  };

  it('S2.1 createStandaloneInvoice persiste nombre, NIF, dirección, tipo y contacto', async () => {
    const { svc } = setupService();

    await svc.createStandaloneInvoice(lineas, 0.21, hoy, vence, undefined, clienteNif);

    expect(mockAddDoc.mock.calls[0][1]).toMatchObject({
      clienteNombre: 'Ana Pérez',
      clienteNif: '12345678Z',
      clienteDireccion: 'Calle Mayor 1, Madrid',
      clienteTipoId: 'nif',
      clienteContactoId: 'c-1',
    });
  });

  it('S2.2 createInvoiceForCaso persiste el cliente completo', async () => {
    const { svc } = setupService();

    await svc.createInvoiceForCaso('caso-1', lineas, 0.21, hoy, vence, undefined, 'Caso', clienteNif);

    expect(mockAddDoc.mock.calls[0][1]).toMatchObject({
      casoId: 'caso-1',
      clienteNombre: 'Ana Pérez',
      clienteNif: '12345678Z',
      clienteTipoId: 'nif',
      clienteContactoId: 'c-1',
    });
  });

  it('saveDraft persiste el cliente (documento extranjero sin normalizar a NIF)', async () => {
    const { svc } = setupService();

    await svc.saveDraft(lineas, 0.21, hoy, vence, undefined, undefined, undefined, {
      nombre: 'John Smith',
      tipoId: 'extranjero',
      nif: ' pa-123 ',
    });

    expect(mockAddDoc.mock.calls[0][1]).toMatchObject({
      status: 'borrador',
      clienteNombre: 'John Smith',
      clienteNif: 'pa-123',
      clienteTipoId: 'extranjero',
    });
  });

  it('S2.5 un NIF con espacios y minúsculas se guarda normalizado', async () => {
    const { svc } = setupService();

    await svc.createStandaloneInvoice(lineas, 0.21, hoy, vence, undefined, { ...clienteNif, nif: ' 12.345.678-z ' });

    expect(mockAddDoc.mock.calls[0][1].clienteNif).toBe('12345678Z');
  });

  it('sin cliente no escribe campos de cliente', async () => {
    const { svc } = setupService();

    await svc.createStandaloneInvoice(lineas, 0.21, hoy, vence);

    expect(Object.keys(mockAddDoc.mock.calls[0][1])).not.toContain('clienteNombre');
    expect(Object.keys(mockAddDoc.mock.calls[0][1])).not.toContain('clienteTipoId');
  });

  it('S2.3 updateInvoiceContent persiste el cliente recibido', async () => {
    const { svc } = setupService();
    stubGetDoc(makeInvoiceDoc({ status: 'borrador' }));

    await svc.updateInvoiceContent('inv-1', lineas, 0.21, hoy, vence, 'nota', clienteNif);

    expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({
      clienteNombre: 'Ana Pérez',
      clienteNif: '12345678Z',
      clienteDireccion: 'Calle Mayor 1, Madrid',
      clienteTipoId: 'nif',
      clienteContactoId: 'c-1',
    });
  });

  it('S2.3 updateInvoiceContent borra en Firestore el NIF, la dirección y el contacto que el usuario vació', async () => {
    const { svc } = setupService();
    stubGetDoc(makeInvoiceDoc({ status: 'borrador', clienteNif: 'B12345674', clienteDireccion: 'Antigua', clienteContactoId: 'c-1' }));

    await svc.updateInvoiceContent('inv-1', lineas, 0.21, hoy, vence, undefined, { nombre: 'Cliente puntual', tipoId: 'nif' });

    expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({
      clienteNombre: 'Cliente puntual',
      clienteNif: '__deleteField__',
      clienteDireccion: '__deleteField__',
      clienteContactoId: '__deleteField__',
    });
  });

  it('S2.3 updateInvoiceContent sin cliente no toca los campos de cliente', async () => {
    const { svc } = setupService();
    stubGetDoc(makeInvoiceDoc({ status: 'borrador', clienteNombre: 'Previo' }));

    await svc.updateInvoiceContent('inv-1', lineas, 0.21, hoy, vence);

    expect(Object.keys(mockUpdateDoc.mock.calls[0][1])).not.toContain('clienteNombre');
  });

  it('S2.3 updateInvoiceContent regenera el PDF con el cliente nuevo si no es borrador', async () => {
    const { svc, generateAndUpload } = setupService();
    stubGetDoc(makeInvoiceDoc({ status: 'pendiente', clienteNombre: 'Previo' }));

    await svc.updateInvoiceContent('inv-1', lineas, 0.21, hoy, vence, undefined, clienteNif);

    await vi.waitFor(() => expect(generateAndUpload).toHaveBeenCalledTimes(1));
    expect(generateAndUpload.mock.calls[0][0]).toMatchObject({
      clienteNombre: 'Ana Pérez',
      clienteNif: '12345678Z',
      clienteTipoId: 'nif',
    });
  });

  it('S2.4 createRectificativa copia clienteTipoId y clienteContactoId de la original', async () => {
    const { svc } = setupService();
    stubGetDoc(
      makeInvoiceDoc({
        clienteNombre: 'Ana Pérez',
        clienteNif: 'PA123',
        clienteTipoId: 'extranjero',
        clienteContactoId: 'c-9',
      }),
    );

    await svc.createRectificativa('inv-1', lineas, 0.21, hoy, vence);

    expect(mockAddDoc.mock.calls[0][1]).toMatchObject({
      clienteNombre: 'Ana Pérez',
      clienteNif: 'PA123',
      clienteTipoId: 'extranjero',
      clienteContactoId: 'c-9',
    });
  });

  it('S2.6 ningún payload de cliente escribe `verifactu`', async () => {
    const { svc } = setupService();
    stubGetDoc(makeInvoiceDoc({ status: 'borrador' }));

    await svc.createStandaloneInvoice(lineas, 0.21, hoy, vence, undefined, clienteNif);
    await svc.createInvoiceForCaso('caso-1', lineas, 0.21, hoy, vence, undefined, 'Caso', clienteNif);
    await svc.saveDraft(lineas, 0.21, hoy, vence, undefined, undefined, undefined, clienteNif);
    await svc.updateInvoiceContent('inv-1', lineas, 0.21, hoy, vence, undefined, clienteNif);

    expect(escrituras().length).toBeGreaterThanOrEqual(4);
    for (const data of escrituras()) expect(Object.keys(data)).not.toContain('verifactu');
  });
});
