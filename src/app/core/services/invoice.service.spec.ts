import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { InvoiceService, InvoiceLinea } from './invoice.service';
import { CompanyService, Company } from './company.service';
import { VerifactuClientService } from './verifactu-client.service';

// ────────────────────────────────────────────────────
// vi.hoisted: variables accesibles DENTRO de vi.mock (hoisting seguro)
// ────────────────────────────────────────────────────

const { mockAddDoc, mockGetDocs, mockUpdateDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn().mockResolvedValue({ id: 'invoice-123' }),
  mockGetDocs: vi.fn().mockResolvedValue({ docs: [] }),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
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
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
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
    nif,
    verifactu: verifactuEnabled ? { enabled: true } : undefined,
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
      { provide: CompanyService, useValue: buildCompanyService(companyOverride) },
      { provide: VerifactuClientService, useValue: verifactuClient },
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

  it('base = suma de todas las líneas, IVA solo en las marcadas', async () => {
    const { svc } = setupService();
    const lineas: InvoiceLinea[] = [
      { concepto: 'Honorarios', base: 1000, aplicaIva: true },
      { concepto: 'Suplidos', base: 200, aplicaIva: false },
    ];

    const id = await svc.createInvoiceForCaso('caso-1', lineas, 0.21);

    const [_collRef, invoiceData] = mockAddDoc.mock.calls[0];
    expect(id).toBe('invoice-gen');
    expect(invoiceData.amount).toBe(1200);       // 1000 + 200
    expect(invoiceData.vat).toBeCloseTo(210);    // solo 1000 * 0.21
    expect(invoiceData.total).toBeCloseTo(1410); // 1200 + 210
  });

  it('ninguna línea con IVA → vat = 0', async () => {
    const { svc } = setupService();
    const lineas: InvoiceLinea[] = [
      { concepto: 'Suplidos', base: 500, aplicaIva: false },
      { concepto: 'Ingresos', base: 300, aplicaIva: false },
    ];

    await svc.createInvoiceForCaso('caso-1', lineas, 0.21);

    const [, invoiceData] = mockAddDoc.mock.calls[0];
    expect(invoiceData.vat).toBe(0);
    expect(invoiceData.total).toBe(800);
  });

  it('todas las líneas con IVA → vat = base * rate', async () => {
    const { svc } = setupService();
    const lineas: InvoiceLinea[] = [
      { concepto: 'Honorarios', base: 2000, aplicaIva: true },
    ];

    await svc.createInvoiceForCaso('caso-1', lineas, 0.1);

    const [, invoiceData] = mockAddDoc.mock.calls[0];
    expect(invoiceData.amount).toBe(2000);
    expect(invoiceData.vat).toBeCloseTo(200);
    expect(invoiceData.total).toBeCloseTo(2200);
  });

  it('guarda casoId en el documento de Firestore', async () => {
    const { svc } = setupService();
    await svc.createInvoiceForCaso('caso-xyz', [{ concepto: 'H', base: 100, aplicaIva: true }], 0.21);
    const [, invoiceData] = mockAddDoc.mock.calls[0];
    expect(invoiceData.casoId).toBe('caso-xyz');
  });

  it('status inicial es "pendiente"', async () => {
    const { svc } = setupService();
    await svc.createInvoiceForCaso('caso-1', [{ concepto: 'H', base: 500, aplicaIva: true }], 0.21);
    const [, invoiceData] = mockAddDoc.mock.calls[0];
    expect(invoiceData.status).toBe('pendiente');
  });

  it('issueDate hoy, dueDate = issueDate + 30 días', async () => {
    const { svc } = setupService();
    await svc.createInvoiceForCaso('caso-1', [{ concepto: 'H', base: 100, aplicaIva: true }], 0.21);
    const [, invoiceData] = mockAddDoc.mock.calls[0];

    const today = new Date().toISOString().slice(0, 10);
    const expected30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    expect(invoiceData.issueDate).toBe(today);
    expect(invoiceData.dueDate).toBe(expected30);
  });

  it('NO dispara Verifactu si la empresa no lo tiene habilitado', async () => {
    const { svc, verifactuClient } = setupService({ verifactuEnabled: false });
    await svc.createInvoiceForCaso('caso-1', [{ concepto: 'H', base: 100, aplicaIva: true }], 0.21);
    expect(verifactuClient.prepareVerifactu).not.toHaveBeenCalled();
  });

  it('SÍ dispara Verifactu si la empresa tiene enabled=true y nif', async () => {
    const { svc, verifactuClient } = setupService({ verifactuEnabled: true, nif: 'B12345678' });
    await svc.createInvoiceForCaso('caso-1', [{ concepto: 'H', base: 100, aplicaIva: true }], 0.21);
    // Verifactu es fire-and-forget → esperamos un tick
    await vi.waitFor(() => expect(verifactuClient.prepareVerifactu).toHaveBeenCalled());
  });

  it('lanza si no hay companyId activo', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        InvoiceService,
        { provide: Firestore, useValue: {} },
        { provide: Functions, useValue: {} },
        { provide: CompanyService, useValue: { activeCompany: signal<Company | null>(null) } },
        { provide: VerifactuClientService, useValue: buildVerifactuClient() },
      ],
    });
    const svc = TestBed.inject(InvoiceService);
    await expect(
      svc.createInvoiceForCaso('caso-1', [{ concepto: 'H', base: 100, aplicaIva: true }], 0.21)
    ).rejects.toThrow('No active company');
  });
});
