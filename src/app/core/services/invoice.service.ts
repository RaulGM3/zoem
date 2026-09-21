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

export type InvoiceStatus = 'borrador' | 'pendiente' | 'pagada' | 'vencida' | 'anulada';

/** Tipo de factura según codificación AEAT. F1 = ordinaria, R1 = rectificativa por diferencias. */
export type TipoFactura = 'F1' | 'R1';

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  amount: number;
  vat: number;
  total: number;
  status: InvoiceStatus;
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
  notes?: string;
  pdfUrl?: string;
  verifactu?: VerifactuEstado;
  /** Tipo de factura AEAT. Default 'F1' (ordinaria). */
  tipoFactura?: TipoFactura;
  /** ID de la factura original que esta rectificativa corrige. */
  facturaRectificadaId?: string;
  /** Número de la factura original (snapshot para display). */
  facturaRectificadaNumero?: string;
  /** El número fue sobrescrito manualmente, fuera de la serie automática. */
  numeroManual?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Línea editable de factura. El usuario controla concepto, cantidad, precio
 * unitario e IVA por línea. `base` se persiste como cantidad * precioUnitario
 * para backward compat con documentos antiguos que solo tenían { concepto, base, aplicaIva }.
 */
export interface InvoiceLinea {
  concepto: string;
  descripcion?: string;
  cantidad: number;
  precioUnitario: number;
  base: number;
  aplicaIva: boolean;
  ivaRate?: number;
}

/** Normaliza una línea leída de Firestore, rellenando campos nuevos si faltan (backward compat). */
export function normalizeLinea(l: Partial<InvoiceLinea>): InvoiceLinea {
  const base = l.base ?? 0;
  return {
    concepto: l.concepto ?? '',
    descripcion: l.descripcion,
    cantidad: l.cantidad ?? 1,
    precioUnitario: l.precioUnitario ?? base,
    base: l.cantidad != null && l.precioUnitario != null ? l.cantidad * l.precioUnitario : base,
    aplicaIva: l.aplicaIva ?? false,
    ivaRate: l.ivaRate,
  };
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
   * Siguiente número de factura. Formato `F-YYYY-NNNN` para ordinarias, `R-YYYY-NNNN`
   * para rectificativas. Calculado como max del año + 1 (client-side, race-condition
   * aceptable para MVP).
   */
  nextInvoiceNumber(tipo: TipoFactura = 'F1'): string {
    const year = new Date().getFullYear();
    const letter = tipo === 'R1' ? 'R' : 'F';
    const prefix = `${letter}-${year}-`;
    const max = this.invoices()
      .map((i) => i.invoiceNumber)
      .filter((n) => n?.startsWith(prefix))
      .reduce((acc, n) => Math.max(acc, Number(n.slice(prefix.length)) || 0), 0);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }

  /**
   * Genera una factura para un caso a partir de líneas editables. El IVA se aplica
   * por línea según su `ivaRate` individual o la tasa global `ivaRate`. Devuelve el id.
   */
  async createInvoiceForCaso(
    casoId: string,
    lineas: InvoiceLinea[],
    ivaRate: number,
    issueDate: string,
    dueDate: string,
    notes?: string,
    casoTitulo?: string,
    cliente?: { nombre: string; nif?: string; direccion?: string },
  ): Promise<string> {
    const amount = lineas.reduce((s, l) => s + l.base, 0);
    const vat = lineas.reduce((s, l) => {
      if (!l.aplicaIva) return s;
      const rate = l.ivaRate ?? ivaRate;
      return s + l.base * rate;
    }, 0);
    const total = amount + vat;

    const invoiceData = {
      invoiceNumber: this.nextInvoiceNumber(),
      amount,
      vat,
      total,
      status: 'pendiente' as InvoiceStatus,
      issueDate,
      dueDate,
      casoId,
      casoTitulo,
      clienteNombre: cliente?.nombre,
      clienteNif: cliente?.nif,
      clienteDireccion: cliente?.direccion,
      lineas,
      ivaRate,
      notes,
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
    console.log('[Verifactu] Iniciando submit para factura:', invoiceId);
    this.verifactuClient
      .prepareVerifactu(invoice, companyId)
      .then(async ({ registro, estadoInicial }) => {
        console.log('[Verifactu] Registro preparado:', JSON.stringify(registro, null, 2));
        console.log('[Verifactu] Estado inicial:', estadoInicial);

        await this.updateInvoice(invoiceId, { verifactu: estadoInicial });
        console.log('[Verifactu] Estado "pendiente" guardado en Firestore');

        const fn = httpsCallable<
          { companyId: string; registro: unknown },
          VerifactuSubmitResponse
        >(this.functions, 'verifactuSubmit');

        console.log('[Verifactu] Llamando Cloud Function verifactuSubmit...');
        try {
          const result = await fn({ companyId, registro });
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

  // ── Lifecycle methods ────────────────────────────────────────────────────

  /** Guarda la factura como borrador sin disparar Verifactu ni generar PDF. */
  async saveDraft(
    lineas: InvoiceLinea[],
    ivaRate: number,
    issueDate: string,
    dueDate: string,
    notes?: string,
    casoId?: string,
    casoTitulo?: string,
    cliente?: { nombre: string; nif?: string; direccion?: string },
  ): Promise<string> {
    const amount = lineas.reduce((s, l) => s + l.base, 0);
    const vat = lineas.reduce((s, l) => {
      if (!l.aplicaIva) return s;
      return s + l.base * (l.ivaRate ?? ivaRate);
    }, 0);

    return this.createInvoice({
      invoiceNumber: this.nextInvoiceNumber(),
      amount,
      vat,
      total: amount + vat,
      status: 'borrador',
      issueDate,
      dueDate,
      casoId,
      casoTitulo,
      clienteNombre: cliente?.nombre,
      clienteNif: cliente?.nif,
      clienteDireccion: cliente?.direccion,
      lineas,
      ivaRate,
      notes,
    });
  }

  /** Finaliza un borrador: cambia status a pendiente, genera PDF y dispara Verifactu. */
  async finalizeDraft(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) throw new Error('Factura no encontrada');
    if (invoice.status !== 'borrador') throw new Error('Solo se pueden finalizar borradores');

    await this.updateInvoice(invoiceId, { status: 'pendiente' });

    const company = this.companyService.activeCompany();
    const identificacion = company ? getIdentificacionFiscal(company) : undefined;
    const fullInvoice: Invoice = { ...invoice, status: 'pendiente' };

    if (company?.verifactu?.enabled && identificacion) {
      this.submitVerifactu(invoiceId, fullInvoice, company.id);
    }

    if (company?.id) {
      this.pdfService.generateAndUpload(fullInvoice)
        .then(pdfUrl => this.updateInvoice(invoiceId, { pdfUrl }))
        .catch(err => console.error('[PDF] Error generando PDF:', err));
    }
  }

  /**
   * Actualiza el contenido de una factura existente (líneas, fechas, notas).
   * Solo permitido si no ha sido enviada a Verifactu.
   */
  async updateInvoiceContent(
    invoiceId: string,
    lineas: InvoiceLinea[],
    ivaRate: number,
    issueDate: string,
    dueDate: string,
    notes?: string,
  ): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) throw new Error('Factura no encontrada');
    if (invoice.verifactu?.estado === 'enviado') {
      throw new Error('No se puede editar una factura ya registrada en Verifactu');
    }

    const amount = lineas.reduce((s, l) => s + l.base, 0);
    const vat = lineas.reduce((s, l) => {
      if (!l.aplicaIva) return s;
      return s + l.base * (l.ivaRate ?? ivaRate);
    }, 0);

    await this.updateInvoice(invoiceId, {
      lineas,
      ivaRate,
      issueDate,
      dueDate,
      notes,
      amount,
      vat,
      total: amount + vat,
    });

    // Regenerar PDF si la factura no es borrador
    if (invoice.status !== 'borrador') {
      const company = this.companyService.activeCompany();
      if (company?.id) {
        const updated: Invoice = { ...invoice, lineas, ivaRate, issueDate, dueDate, notes, amount, vat, total: amount + vat };
        this.pdfService.generateAndUpload(updated)
          .then(pdfUrl => this.updateInvoice(invoiceId, { pdfUrl }))
          .catch(err => console.error('[PDF] Error regenerando PDF:', err));
      }
    }
  }

  async markAsPaid(invoiceId: string, paidDate?: string): Promise<void> {
    await this.updateInvoice(invoiceId, {
      status: 'pagada',
      paidDate: paidDate ?? new Date().toISOString().slice(0, 10),
    });
  }

  /** Reintentar envío a Verifactu para facturas con estado 'error'. */
  async retryVerifactu(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) throw new Error('Factura no encontrada');
    if (invoice.verifactu?.estado !== 'error') throw new Error('Solo se puede reintentar facturas con error');

    const company = this.companyService.activeCompany();
    const identificacion = company ? getIdentificacionFiscal(company) : undefined;
    if (!company?.verifactu?.enabled || !identificacion) {
      throw new Error('Verifactu no está configurado para esta empresa');
    }

    this.submitVerifactu(invoiceId, invoice, company.id);
  }

  /**
   * Sobrescribe manualmente el número de una factura. Pensado para el caso en que
   * la factura ya se emitió fuera del sistema (a mano o con otro software) y hay que
   * hacer coincidir la numeración.
   *
   * Restricciones: no se puede tocar una factura ya aceptada por Verifactu (el número
   * forma parte del `IDFactura` registrado y de la cadena de huellas en la AEAT), ni
   * una factura anulada. El número debe ser único dentro de la empresa.
   *
   * Marca `numeroManual: true`: ese número queda fuera de la serie automática, así que
   * `nextInvoiceNumber()` no lo tiene en cuenta salvo que respete el formato `F-YYYY-NNNN`.
   */
  async updateInvoiceNumber(invoiceId: string, newNumber: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) throw new Error('Factura no encontrada');
    if (invoice.verifactu?.estado === 'enviado') {
      throw new Error('No se puede cambiar el número de una factura ya registrada en Verifactu');
    }
    if (invoice.status === 'anulada') {
      throw new Error('No se puede cambiar el número de una factura anulada');
    }

    const numero = newNumber.trim();
    if (!numero) throw new Error('El número de factura no puede estar vacío');
    if (numero === invoice.invoiceNumber) return;

    const duplicado = this.invoices().some(i => i.id !== invoiceId && i.invoiceNumber === numero);
    if (duplicado) throw new Error(`El número ${numero} ya está en uso por otra factura`);

    await this.updateInvoice(invoiceId, { invoiceNumber: numero, numeroManual: true });

    // El número va impreso en el PDF, hay que regenerarlo.
    if (invoice.status !== 'borrador' && this.companyService.activeCompany()?.id) {
      this.pdfService
        .generateAndUpload({ ...invoice, invoiceNumber: numero, numeroManual: true })
        .then(pdfUrl => this.updateInvoice(invoiceId, { pdfUrl }))
        .catch(err => console.error('[PDF] Error regenerando PDF tras cambio de número:', err));
    }
  }

  /** Facturas pendientes cuya fecha de vencimiento ya pasó. */
  getOverdueInvoices(): Invoice[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.invoices().filter(i => i.status === 'pendiente' && i.dueDate < today);
  }

  /** Anula una factura: cambia status a 'anulada' y envía RegistroBaja a Verifactu si aplica. */
  async anularFactura(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) throw new Error('Factura no encontrada');
    if (invoice.status === 'anulada') throw new Error('La factura ya está anulada');

    await this.updateInvoice(invoiceId, { status: 'anulada' });

    // Si la factura fue enviada a Verifactu, enviar RegistroBaja
    if (invoice.verifactu?.estado === 'enviado') {
      const company = this.companyService.activeCompany();
      const identificacion = company ? getIdentificacionFiscal(company) : undefined;
      if (company?.verifactu?.enabled && identificacion) {
        this.submitVerifactuBaja(invoiceId, invoice, company.id);
      }
    }
  }

  private submitVerifactuBaja(invoiceId: string, invoice: Invoice, companyId: string): void {
    console.log('[Verifactu] Iniciando baja para factura:', invoiceId);
    this.verifactuClient
      .prepareBaja(invoice, companyId)
      .then(async ({ registro, estadoInicial }) => {
        await this.updateInvoice(invoiceId, { verifactu: { ...invoice.verifactu, ...estadoInicial, estado: 'pendiente' } });

        const fn = httpsCallable<
          { companyId: string; registro: unknown; tipo: string },
          VerifactuSubmitResponse
        >(this.functions, 'verifactuSubmit');

        try {
          const result = await fn({ companyId, registro, tipo: 'baja' });
          const { csv, estado } = result.data;
          // Conservamos el estado del alta (qrUrl, csv original) y añadimos los datos
          // de la baja: pisarlo dejaría el PDF sin QR de verificación AEAT.
          await this.updateInvoice(invoiceId, {
            verifactu: {
              ...invoice.verifactu,
              ...estadoInicial,
              estado: estado === 'aceptado' ? 'enviado' : 'error',
              csvBaja: csv || undefined,
              bajaAt: new Date().toISOString(),
            },
          });
        } catch (err) {
          console.error('[Verifactu] RegistroBaja falló:', err);
          await this.updateInvoice(invoiceId, {
            verifactu: {
              ...invoice.verifactu,
              ...estadoInicial,
              estado: 'error',
              error: err instanceof Error ? err.message : 'Error al enviar baja',
            },
          });
        }
      })
      .catch(err => console.error('[Verifactu] prepareBaja falló:', err));
  }

  // ── Standalone + Rectificativa ──────────────────────────────────────────

  /** Crea una factura sin caso asociado. */
  async createStandaloneInvoice(
    lineas: InvoiceLinea[],
    ivaRate: number,
    issueDate: string,
    dueDate: string,
    notes?: string,
    cliente?: { nombre: string; nif?: string; direccion?: string },
  ): Promise<string> {
    const amount = lineas.reduce((s, l) => s + l.base, 0);
    const vat = lineas.reduce((s, l) => {
      if (!l.aplicaIva) return s;
      return s + l.base * (l.ivaRate ?? ivaRate);
    }, 0);

    const invoiceData = {
      invoiceNumber: this.nextInvoiceNumber('F1'),
      amount,
      vat,
      total: amount + vat,
      status: 'pendiente' as InvoiceStatus,
      issueDate,
      dueDate,
      clienteNombre: cliente?.nombre,
      clienteNif: cliente?.nif,
      clienteDireccion: cliente?.direccion,
      lineas,
      ivaRate,
      notes,
      tipoFactura: 'F1' as TipoFactura,
    };

    const invoiceId = await this.createInvoice(invoiceData);

    const company = this.companyService.activeCompany();
    const identificacion = company ? getIdentificacionFiscal(company) : undefined;

    if (company?.verifactu?.enabled && identificacion) {
      const fullInvoice: Invoice = { id: invoiceId, companyId: company.id, ...invoiceData };
      this.submitVerifactu(invoiceId, fullInvoice, company.id);
    }

    if (company?.id) {
      const fullInvoice: Invoice = { id: invoiceId, companyId: company.id, ...invoiceData };
      this.pdfService.generateAndUpload(fullInvoice)
        .then(pdfUrl => this.updateInvoice(invoiceId, { pdfUrl }))
        .catch(err => console.error('[PDF] Error generando PDF:', err));
    }

    return invoiceId;
  }

  /** Crea una factura rectificativa (R1) que referencia la original. */
  async createRectificativa(
    originalInvoiceId: string,
    lineas: InvoiceLinea[],
    ivaRate: number,
    issueDate: string,
    dueDate: string,
    notes?: string,
  ): Promise<string> {
    const original = await this.getInvoice(originalInvoiceId);
    if (!original) throw new Error('Factura original no encontrada');

    const amount = lineas.reduce((s, l) => s + l.base, 0);
    const vat = lineas.reduce((s, l) => {
      if (!l.aplicaIva) return s;
      return s + l.base * (l.ivaRate ?? ivaRate);
    }, 0);

    const invoiceData = {
      invoiceNumber: this.nextInvoiceNumber('R1'),
      amount,
      vat,
      total: amount + vat,
      status: 'pendiente' as InvoiceStatus,
      issueDate,
      dueDate,
      casoId: original.casoId,
      casoTitulo: original.casoTitulo,
      clienteNombre: original.clienteNombre,
      clienteNif: original.clienteNif,
      clienteDireccion: original.clienteDireccion,
      lineas,
      ivaRate,
      notes: notes ?? `Rectificativa de ${original.invoiceNumber}`,
      tipoFactura: 'R1' as TipoFactura,
      facturaRectificadaId: originalInvoiceId,
      facturaRectificadaNumero: original.invoiceNumber,
    };

    const invoiceId = await this.createInvoice(invoiceData);

    const company = this.companyService.activeCompany();
    const identificacion = company ? getIdentificacionFiscal(company) : undefined;

    if (company?.verifactu?.enabled && identificacion) {
      const fullInvoice: Invoice = { id: invoiceId, companyId: company.id, ...invoiceData };
      this.submitVerifactu(invoiceId, fullInvoice, company.id);
    }

    if (company?.id) {
      const fullInvoice: Invoice = { id: invoiceId, companyId: company.id, ...invoiceData };
      this.pdfService.generateAndUpload(fullInvoice)
        .then(pdfUrl => this.updateInvoice(invoiceId, { pdfUrl }))
        .catch(err => console.error('[PDF] Error generando PDF:', err));
    }

    return invoiceId;
  }
}
