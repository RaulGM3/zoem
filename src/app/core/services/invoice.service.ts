import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { CompanyService } from './company.service';
import { VerifactuClientService } from './verifactu-client.service';
import { VerifactuEstado, VerifactuSubmitResponse } from '../../interfaces/verifactu.interface';

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  amount: number;
  vat: number;
  total: number;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  contactId?: string;
  projectId?: string;
  casoId?: string;
  verifactu?: VerifactuEstado;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Línea editable al generar una factura desde un caso. El usuario decide la base
 * de cada concepto y si lleva IVA (modelo fiscal flexible, sin hardcodear).
 */
export interface InvoiceLinea {
  concepto: string;
  base: number;
  aplicaIva: boolean;
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly firestore = inject(Firestore);
  private readonly functions = inject(Functions);
  private readonly companyService = inject(CompanyService);
  private readonly verifactuClient = inject(VerifactuClientService);

  readonly invoices = signal<Invoice[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  async loadInvoices(): Promise<void> {
    this.isLoading.set(true);
    try {
      const q = query(
        collection(this.firestore, 'invoices'),
        where('companyId', '==', this.companyId)
      );
      const snapshot = await getDocs(q);
      this.invoices.set(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Invoice));
    } finally {
      this.isLoading.set(false);
    }
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const snapshot = await getDoc(doc(this.firestore, 'invoices', id));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Invoice) : null;
  }

  async createInvoice(data: Omit<Invoice, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = await addDoc(collection(this.firestore, 'invoices'), {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await this.loadInvoices();
    return ref.id;
  }

  /**
   * Siguiente número de factura con formato `F-YYYY-NNNN`, calculado como el máximo
   * del año en curso + 1 sobre las facturas ya cargadas en memoria. Es un cálculo de
   * cliente: una carrera entre dos generaciones simultáneas podría repetir número
   * (aceptable para el MVP; un contador transaccional lo resolvería más adelante).
   */
  nextInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const prefix = `F-${year}-`;
    const max = this.invoices()
      .map((i) => i.invoiceNumber)
      .filter((n) => n?.startsWith(prefix))
      .reduce((acc, n) => Math.max(acc, Number(n.slice(prefix.length)) || 0), 0);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }

  /**
   * Genera una factura para un caso a partir de líneas editables. El IVA se aplica
   * por línea según `aplicaIva` y la tasa `ivaRate` (p. ej. 0.21). Devuelve el id.
   */
  async createInvoiceForCaso(casoId: string, lineas: InvoiceLinea[], ivaRate: number): Promise<string> {
    const amount = lineas.reduce((s, l) => s + l.base, 0);
    const vat = lineas.reduce((s, l) => s + (l.aplicaIva ? l.base * ivaRate : 0), 0);
    const total = amount + vat;
    const issue = new Date();
    const due = new Date(issue);
    due.setDate(due.getDate() + 30);

    const invoiceData = {
      invoiceNumber: this.nextInvoiceNumber(),
      amount,
      vat,
      total,
      status: 'pendiente' as const,
      issueDate: issue.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      casoId,
    };

    const invoiceId = await this.createInvoice(invoiceData);
    const company = this.companyService.activeCompany();

    if (company?.verifactu?.enabled && company.nif) {
      const fullInvoice: Invoice = { id: invoiceId, companyId: company.id, ...invoiceData };
      this.submitVerifactu(invoiceId, fullInvoice, company.id);
    }

    return invoiceId;
  }

  private submitVerifactu(invoiceId: string, invoice: Invoice, companyId: string): void {
    this.verifactuClient
      .prepareVerifactu(invoice, companyId)
      .then(async ({ registro, estadoInicial }) => {
        await this.updateInvoice(invoiceId, { verifactu: estadoInicial });

        const fn = httpsCallable<
          { companyId: string; registro: unknown },
          VerifactuSubmitResponse
        >(this.functions, 'verifactuSubmit');

        try {
          const result = await fn({ companyId, registro });
          const { csv, estado } = result.data;
          const verifactuFinal: VerifactuEstado = {
            ...estadoInicial,
            estado: estado === 'aceptado' ? 'enviado' : 'error',
            csv: csv || undefined,
            enviadoAt: new Date().toISOString(),
          };
          await this.updateInvoice(invoiceId, { verifactu: verifactuFinal });
        } catch (err) {
          const verifactuError: VerifactuEstado = {
            ...estadoInicial,
            estado: 'error',
            error: err instanceof Error ? err.message : 'Error desconocido',
          };
          await this.updateInvoice(invoiceId, { verifactu: verifactuError });
        }
      })
      .catch(() => {
        // Si falla la preparación local (ej. sin NIF) no bloqueamos la factura
      });
  }

  async updateInvoice(id: string, data: Partial<Omit<Invoice, 'id' | 'companyId'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'invoices', id), { ...data, updatedAt: serverTimestamp() });
    await this.loadInvoices();
  }

  async deleteInvoice(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'invoices', id));
    this.invoices.update((list) => list.filter((i) => i.id !== id));
  }
}
