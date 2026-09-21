import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Storage } from '@angular/fire/storage';
import { InvoiceService, InvoiceLinea, Invoice } from './invoice.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { CompanyService, Company } from './company.service';
import { VerifactuClientService } from './verifactu-client.service';

// ────────────────────────────────────────────────────
// vi.hoisted: variables accesibles DENTRO de vi.mock (hoisting seguro)
// ────────────────────────────────────────────────────

const { mockAddDoc, mockGetDocs, mockUpdateDoc, mockGetDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn().mockResolvedValue({ id: 'invoice-123' }),
  mockGetDocs: vi.fn().mockResolvedValue({ docs: [] }),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
  mockGetDoc: vi.fn().mockResolvedValue({ exists: () => false }),
}));

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
}));

vi.mock('@angular/fire/functions', () => ({
  Functions: class {},
  httpsCallable: vi.fn().mockReturnValue(vi.fn().mockResolvedValue({ data: { estado: 'aceptado', csv: 'CSV123' } })),
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

function buildVerifactuClient(): Partial<VerifactuClientService> {
  return {
    prepareVerifactu: vi.fn().mockResolvedValue({
      registro: {},
      estadoInicial: { estado: 'pendiente', numero: 'F-2026-0001' },
    }),
  } as Partial<VerifactuClientService>;
}

function setupService(
  companyOverride: Parameters<typeof buildCompanyService>[0] = {},
): { svc: InvoiceService; verifactuClient: Partial<VerifactuClientService> } {
  const verifactuClient = buildVerifactuClient();
  TestBed.configureTestingModule({
    providers: [
      InvoiceService,
      { provide: Firestore, useValue: {} },
      { provide: Functions, useValue: {} },
      { provide: Storage, useValue: {} },
      { provide: CompanyService, useValue: buildCompanyService(companyOverride) },
      { provide: VerifactuClientService, useValue: verifactuClient },
      { provide: InvoicePdfService, useValue: { generateAndUpload: vi.fn().mockResolvedValue('https://pdf.test/x.pdf') } },
    ],
  });
  return { svc: TestBed.inject(InvoiceService), verifactuClient };
}

// ────────────────────────────────────────────────────
// Tests: nextInvoiceNumber
// ────────────────────────────────────────────────────

describe('InvoiceService.nextInvoiceNumber()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('NO dispara Verifactu si la empresa no lo tiene habilitado', async () => {
    const { svc, verifactuClient } = setupService({ verifactuEnabled: false });
    await svc.createInvoiceForCaso('caso-1', [linea({ concepto: 'H', base: 100, precioUnitario: 100, aplicaIva: true })], 0.21, today, due30);
    expect(verifactuClient.prepareVerifactu).not.toHaveBeenCalled();
  });

  it('SÍ dispara Verifactu si la empresa tiene enabled=true y nif', async () => {
    const { svc, verifactuClient } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    await svc.createInvoiceForCaso('caso-1', [linea({ concepto: 'H', base: 100, precioUnitario: 100, aplicaIva: true })], 0.21, today, due30);
    await vi.waitFor(() => expect(verifactuClient.prepareVerifactu).toHaveBeenCalled());
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
        { provide: VerifactuClientService, useValue: buildVerifactuClient() },
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
    TestBed.resetTestingModule();
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  function makeInvoice(override: Partial<Invoice> = {}): Invoice {
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

  function stubGetInvoice(invoice: Invoice | null): void {
    mockGetDoc.mockResolvedValue(
      invoice
        ? { exists: () => true, id: invoice.id, data: () => invoice }
        : { exists: () => false },
    );
  }

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
    stubGetInvoice(makeInvoice({ verifactu: { estado: 'enviado', huella: 'H', huellaAnterior: '' } }));

    await expect(svc.updateInvoiceNumber('inv-1', 'A/2026/000123')).rejects.toThrow(/Verifactu/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
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
