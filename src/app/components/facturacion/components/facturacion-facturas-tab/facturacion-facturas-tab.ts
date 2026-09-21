import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Download,
  Link,
  Pencil,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  CircleDollarSign,
  RotateCcw,
  Ban,
  Hash,
} from 'lucide-angular';
import type { Invoice, InvoiceStatus } from '../../../../core/services/invoice.service';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  borrador:  { label: 'Borrador',  bg: 'color-mix(in srgb,var(--text-faint) 12%,transparent)', color: 'var(--text-muted)' },
  pendiente: { label: 'Pendiente', bg: 'color-mix(in srgb,var(--warning) 12%,transparent)',    color: 'var(--warning)' },
  pagada:    { label: 'Pagada',    bg: 'color-mix(in srgb,var(--success) 12%,transparent)',    color: 'var(--success)' },
  vencida:   { label: 'Vencida',   bg: 'color-mix(in srgb,var(--danger) 12%,transparent)',     color: 'var(--danger)' },
  anulada:   { label: 'Anulada',   bg: 'color-mix(in srgb,var(--text-faint) 12%,transparent)', color: 'var(--text-faint)' },
};

type StatusFilter = InvoiceStatus | 'todos';

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
  readonly ShieldCheckIcon = ShieldCheck;
  readonly ShieldAlertIcon = ShieldAlert;
  readonly ShieldXIcon = ShieldX;
  readonly RefreshCwIcon = RefreshCw;
  readonly CircleDollarSignIcon = CircleDollarSign;
  readonly RotateCcwIcon = RotateCcw;
  readonly BanIcon = Ban;
  readonly HashIcon = Hash;

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
    return invoice.verifactu?.estado !== 'enviado' && invoice.status !== 'anulada';
  }

  canMarkPaid(invoice: Invoice): boolean {
    return invoice.status === 'pendiente' || invoice.status === 'vencida';
  }

  canRetryVerifactu(invoice: Invoice): boolean {
    return invoice.verifactu?.estado === 'error';
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
   * huellas, así que una vez aceptado por Verifactu es inmutable.
   */
  canEditNumber(invoice: Invoice): boolean {
    return invoice.verifactu?.estado !== 'enviado' && invoice.status !== 'anulada';
  }

  canAnular(invoice: Invoice): boolean {
    return invoice.status !== 'anulada' && invoice.status !== 'borrador';
  }

  verifactuIcon(invoice: Invoice): typeof ShieldCheck {
    const estado = invoice.verifactu?.estado;
    if (estado === 'enviado') return this.ShieldCheckIcon;
    if (estado === 'error') return this.ShieldXIcon;
    if (estado === 'pendiente') return this.ShieldAlertIcon;
    return this.ShieldXIcon;
  }

  verifactuColor(invoice: Invoice): string {
    const estado = invoice.verifactu?.estado;
    if (estado === 'enviado') return 'var(--success)';
    if (estado === 'error') return 'var(--danger)';
    if (estado === 'pendiente') return 'var(--warning)';
    return 'var(--text-faint)';
  }
}
