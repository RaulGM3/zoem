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
import { CompanyService, getIdentificacionFiscal } from './company.service';
import { VerifactuClientService } from './verifactu-client.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
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
  casoTitulo?: string;
  clienteNombre?: string;
  clienteNif?: string;
  clienteDireccion?: string;
  lineas?: InvoiceLinea[];
  ivaRate?: number;
  pdfUrl?: string;
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
  private readonly pdfService = inject(InvoicePdfService);

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
    const ref = await addDoc(collection(this.firestore, 'invoices'), stripUndefinedDeep({
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
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
  async createInvoiceForCaso(
    casoId: string,
    lineas: InvoiceLinea[],
    ivaRate: number,
    casoTitulo?: string,
    cliente?: { nombre: string; nif?: string; direccion?: string },
  ): Promise<string> {
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
      casoTitulo,
      clienteNombre: cliente?.nombre,
      clienteNif: cliente?.nif,
      clienteDireccion: cliente?.direccion,
      lineas,
      ivaRate,
    };

    const invoiceId = await this.createInvoice(invoiceData);
    console.log('[Verifactu] Factura creada en Firestore:', { invoiceId, invoiceData });

    const company = this.companyService.activeCompany();
    const identificacion = company ? getIdentificacionFiscal(company) : undefined;
    console.log('[Verifactu] Guard check:', {
      companyId: company?.id,
      tipoPersona: company?.tipoPersona ?? '⚠️ SIN TIPO',
      identificacion: identificacion ?? '⚠️ SIN NIF/CIF',
      verifactuEnabled: company?.verifactu?.enabled ?? '⚠️ DISABLED',
      pasa: !!(company?.verifactu?.enabled && identificacion),
    });

    if (company?.verifactu?.enabled && identificacion) {
      const fullInvoice: Invoice = { id: invoiceId, companyId: company.id, ...invoiceData };
      this.submitVerifactu(invoiceId, fullInvoice, company.id);
    } else {
      console.warn('[Verifactu] ⛔ Submit cancelado — falta NIF/CIF o verifactu.enabled=false en la empresa');
    }

    // Genera PDF y guarda la URL en Firestore (fire-and-forget — no bloquea el flujo principal)
    if (company?.id) {
      const fullInvoice: Invoice = { id: invoiceId, companyId: company.id, ...invoiceData };
      this.pdfService.generateAndUpload(fullInvoice)
        .then(pdfUrl => this.updateInvoice(invoiceId, { pdfUrl }))
        .catch(err => console.error('[PDF] Error generando PDF de factura:', err));
    }

    return invoiceId;
  }

  private submitVerifactu(invoiceId: string, invoice: Invoice, companyId: string): void {
    const company = this.companyService.activeCompany();
    const sandbox = company?.verifactu?.sandbox ?? true;
    console.log('[Verifactu] Iniciando submit para factura:', invoiceId, '| sandbox:', sandbox);
    this.verifactuClient
      .prepareVerifactu(invoice, companyId)
      .then(async ({ registro, estadoInicial }) => {
        console.log('[Verifactu] Registro preparado:', JSON.stringify(registro, null, 2));
        console.log('[Verifactu] Estado inicial:', estadoInicial);

        await this.updateInvoice(invoiceId, { verifactu: estadoInicial });
        console.log('[Verifactu] Estado "pendiente" guardado en Firestore');

        const fn = httpsCallable<
          { companyId: string; registro: unknown; sandbox: boolean },
          VerifactuSubmitResponse
        >(this.functions, 'verifactuSubmit');

        console.log('[Verifactu] Llamando Cloud Function verifactuSubmit...');
        try {
          const result = await fn({ companyId, registro, sandbox });
          console.log('[Verifactu] Respuesta Cloud Function:', result.data);
          const { csv, estado } = result.data;
          const verifactuFinal: VerifactuEstado = {
            ...estadoInicial,
            estado: estado === 'aceptado' ? 'enviado' : 'error',
            csv: csv || undefined,
            enviadoAt: new Date().toISOString(),
          };
          console.log('[Verifactu] Estado final a persistir:', verifactuFinal);
          await this.updateInvoice(invoiceId, { verifactu: verifactuFinal });

          // Regenerar PDF con QR de Verifactu si fue aceptado
          if (verifactuFinal.estado === 'enviado') {
            const company = this.companyService.activeCompany();
            if (company?.id) {
              const updatedInvoice: Invoice = { ...invoice, id: invoiceId, verifactu: verifactuFinal };
              this.pdfService.generateAndUpload(updatedInvoice)
                .then(pdfUrl => this.updateInvoice(invoiceId, { pdfUrl }))
                .catch(err => console.error('[PDF] Error regenerando PDF con QR Verifactu:', err));
            }
          }
        } catch (err) {
          console.error('[Verifactu] ❌ Cloud Function falló:', err);
          const verifactuError: VerifactuEstado = {
            ...estadoInicial,
            estado: 'error',
            error: err instanceof Error ? err.message : 'Error desconocido',
          };
          await this.updateInvoice(invoiceId, { verifactu: verifactuError });
        }
      })
      .catch((err) => {
        console.error('[Verifactu] ❌ prepareVerifactu falló (silenciado):', err);
      });
  }

  async updateInvoice(id: string, data: Partial<Omit<Invoice, 'id' | 'companyId'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'invoices', id), stripUndefinedDeep({ ...data, updatedAt: serverTimestamp() }));
    await this.loadInvoices();
  }

  async deleteInvoice(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'invoices', id));
    this.invoices.update((list) => list.filter((i) => i.id !== id));
  }
}
