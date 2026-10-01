import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect, untracked } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Download,
  Link,
  Pencil,
  CheckCircle2,
  RefreshCw,
  CircleDollarSign,
  RotateCcw,
  Ban,
  Hash,
} from 'lucide-angular';
import type { Invoice, InvoiceStatus } from '../../../../core/services/invoice.service';
import {
  anuncioCambioVerifactu,
  colorTono,
  tipoReintento,
  verifactuBloqueada,
  vistaVerifactu,
  type VistaVerifactu,
} from '../../../../core/verifactu/verifactu-ui';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  borrador:  { label: 'Borrador',  bg: 'color-mix(in srgb,var(--text-faint) 12%,transparent)', color: 'var(--text-muted)' },
  pendiente: { label: 'Pendiente', bg: 'color-mix(in srgb,var(--warning) 12%,transparent)',    color: 'var(--warning)' },
  pagada:    { label: 'Pagada',    bg: 'color-mix(in srgb,var(--success) 12%,transparent)',    color: 'var(--success)' },
  vencida:   { label: 'Vencida',   bg: 'color-mix(in srgb,var(--danger) 12%,transparent)',     color: 'var(--danger)' },
  anulada:   { label: 'Anulada',   bg: 'color-mix(in srgb,var(--text-faint) 12%,transparent)', color: 'var(--text-faint)' },
};

type StatusFilter = InvoiceStatus | 'todos';

/** Reintento iniciado por el usuario cuyo resultado hay que anunciar (una sola vez). */
interface SeguimientoReintento {
  invoiceId: string;
  referencia: string;
  antes: Pick<VistaVerifactu, 'estado' | 'etiqueta'>;
}

@Component({
  selector: 'app-facturacion-facturas-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './facturacion-facturas-tab.html',
})
export class FacturacionFacturasTabComponent {
  readonly invoices = input.required<Invoice[]>();
  readonly loading = input.required<boolean>();

  readonly editInvoice = output<Invoice>();
  readonly markPaid = output<string>();
  readonly downloadPdf = output<string>();
  readonly copyPdfLink = output<string>();
  readonly retryVerifactu = output<string>();
  readonly finalizeDraft = output<string>();
  readonly createRectificativa = output<Invoice>();
  readonly anularFactura = output<string>();
  readonly editNumber = output<Invoice>();

  readonly DownloadIcon = Download;
  readonly LinkIcon = Link;
  readonly PencilIcon = Pencil;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly RefreshCwIcon = RefreshCw;
  readonly CircleDollarSignIcon = CircleDollarSign;
  readonly RotateCcwIcon = RotateCcw;
  readonly BanIcon = Ban;
  readonly HashIcon = Hash;

  /** Texto de la ÚNICA región viva de la tabla: solo cambios provocados por el usuario. */
  readonly anuncio = signal('');
  private seguimiento: SeguimientoReintento | null = null;

  constructor() {
    effect(() => {
      const invoices = this.invoices();
      const seguimiento = this.seguimiento;
      if (!seguimiento) return;
      untracked(() => {
        const inv = invoices.find((i) => i.id === seguimiento.invoiceId);
        const vista = inv ? vistaVerifactu(inv, Date.now()) : null;
        if (!vista) return;
        const texto = anuncioCambioVerifactu(seguimiento.antes, vista, seguimiento.referencia);
        if (texto === null) return;
        this.anuncio.set(texto);
        this.seguimiento = null;
      });
    });
  }

  readonly searchQuery = signal('');
  readonly statusFilter = signal<StatusFilter>('todos');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'borrador', label: 'Borrador' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'pagada', label: 'Pagada' },
    { value: 'vencida', label: 'Vencida' },
    { value: 'anulada', label: 'Anulada' },
  ];

  readonly filteredInvoices = computed(() => {
    let list = this.invoices();
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const from = this.dateFrom();
    const to = this.dateTo();

    if (q) {
      list = list.filter(i =>
        (i.invoiceNumber?.toLowerCase().includes(q)) ||
        (i.clienteNombre?.toLowerCase().includes(q)) ||
        (i.casoTitulo?.toLowerCase().includes(q))
      );
    }

    if (status !== 'todos') {
      list = list.filter(i => i.status === status);
    }

    if (from) {
      list = list.filter(i => i.issueDate >= from);
    }
    if (to) {
      list = list.filter(i => i.issueDate <= to);
    }

    return list.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  });

  readonly totals = computed(() => {
    const list = this.filteredInvoices();
    return {
      count: list.length,
      base: list.reduce((s, i) => s + i.amount, 0),
      iva: list.reduce((s, i) => s + i.vat, 0),
      total: list.reduce((s, i) => s + i.total, 0),
    };
  });

  statusStyle(status: InvoiceStatus): { background: string; color: string } {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['pendiente'];
    return { background: cfg.bg, color: cfg.color };
  }

  statusLabel(status: InvoiceStatus): string {
    return STATUS_CONFIG[status]?.label ?? status;
  }

  canEdit(invoice: Invoice): boolean {
    return !verifactuBloqueada(invoice) && invoice.status !== 'anulada';
  }

  canMarkPaid(invoice: Invoice): boolean {
    return invoice.status === 'pendiente' || invoice.status === 'vencida';
  }

  /** Error, pendiente o en cola (R9.3); en facturas anuladas reintenta la anulación. */
  canRetryVerifactu(invoice: Invoice): boolean {
    return tipoReintento(invoice) !== null;
  }

  canFinalize(invoice: Invoice): boolean {
    return invoice.status === 'borrador';
  }

  canRectify(invoice: Invoice): boolean {
    return (invoice.status === 'pendiente' || invoice.status === 'pagada')
      && invoice.tipoFactura !== 'R1';
  }

  /**
   * El número forma parte del `IDFactura` registrado en la AEAT y de la cadena de
   * huellas, así que con un registro vivo (en cola, pendiente o enviado) es inmutable.
   */
  canEditNumber(invoice: Invoice): boolean {
    return !verifactuBloqueada(invoice) && invoice.status !== 'anulada';
  }

  canAnular(invoice: Invoice): boolean {
    return invoice.status !== 'anulada' && invoice.status !== 'borrador';
  }

  /** Vista del registro Verifactu; `Date.now()` se lee al renderizar para la antigüedad. */
  verifactuVista(invoice: Invoice): VistaVerifactu | null {
    return vistaVerifactu(invoice, Date.now());
  }

  /** Reintento del usuario: lo anuncia y empieza a seguir el cambio de estado de esa factura. */
  reintentar(invoice: Invoice): void {
    const referencia = `Factura ${invoice.invoiceNumber}`;
    const vista = vistaVerifactu(invoice, Date.now());
    this.seguimiento = vista ? { invoiceId: invoice.id, referencia, antes: { estado: vista.estado, etiqueta: vista.etiqueta } } : null;
    this.anuncio.set(`Reintentando el envío a Verifactu de la factura ${invoice.invoiceNumber}`);
    this.retryVerifactu.emit(invoice.id);
  }

  verifactuColor(vista: VistaVerifactu): string {
    return colorTono(vista.tono);
  }
}
