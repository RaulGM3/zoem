import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect, inject, untracked } from '@angular/core';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton';
import { NgTemplateOutlet } from '@angular/common';
import { DecimalPipe } from '@angular/common';
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
  SlidersHorizontal,
  ShieldCheck,
} from 'lucide-angular';
import { BreakpointService } from '../../../../core/services/breakpoint.service';
import { ActionMenuComponent, type MenuAction } from '../../../../shared/components/action-menu/action-menu';
import { OverlayShellComponent } from '../../../../shared/components/overlay-shell/overlay-shell';
import {
  ListCardDirective,
  ListTableDirective,
  ResponsiveListComponent,
} from '../../../../shared/components/responsive-list/responsive-list';
import type { Invoice, InvoiceStatus } from '../../../../core/services/invoice.service';
import {
  anuncioCambioVerifactu,
  colorTono,
  tipoReintento,
  verifactuBloqueada,
  vistaVerifactu,
  type VistaVerifactu,
} from '../../../../core/verifactu/verifactu-ui';
import { estiloEstadoFactura, etiquetaEstadoFactura } from '../../../../core/facturacion/estado-factura';
import { fechaCorta } from '../../../../core/facturacion/fecha-corta';

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
  imports: [SkeletonComponent, 
    LucideAngularModule, DecimalPipe, FormsModule, NgTemplateOutlet, ActionMenuComponent, OverlayShellComponent,
    ResponsiveListComponent, ListCardDirective, ListTableDirective,
  ],
  templateUrl: './facturacion-facturas-tab.html',
})
export class FacturacionFacturasTabComponent {
  protected readonly bp = inject(BreakpointService);

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
  readonly FiltersIcon = SlidersHorizontal;
  readonly ShieldCheckIcon = ShieldCheck;

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

  /** Hoja de filtros (móvil). Comparte las mismas señales que la barra de escritorio. */
  readonly filtrosAbiertos = signal(false);

  /** Filtros activos que oculta la hoja: estado y rango de fechas (la búsqueda va siempre visible). */
  readonly filtrosActivos = computed(
    () => (this.statusFilter() !== 'todos' ? 1 : 0) + (this.dateFrom() ? 1 : 0) + (this.dateTo() ? 1 : 0),
  );

  limpiarFiltros(): void {
    this.statusFilter.set('todos');
    this.dateFrom.set('');
    this.dateTo.set('');
  }

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

  readonly statusStyle = estiloEstadoFactura;
  readonly statusLabel = etiquetaEstadoFactura;
  readonly fechaCorta = fechaCorta;

  /** Acción destacada en la tarjeta móvil (también sigue en el menú ⋯). */
  accionPrincipal(inv: Invoice): Required<Pick<MenuAction, 'id' | 'label' | 'icon'>> | null {
    if (this.canFinalize(inv)) return { id: 'finalize', label: 'Finalizar', icon: CheckCircle2 };
    if (this.canMarkPaid(inv)) return { id: 'markPaid', label: 'Marcar pagada', icon: CircleDollarSign };
    return null;
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

  /** Mismas condiciones (y orden) que los botones de icono de la tabla de escritorio. */
  accionesFactura(inv: Invoice): MenuAction[] {
    const acciones: MenuAction[] = [];
    if (this.canEdit(inv)) acciones.push({ id: 'edit', label: 'Editar factura', icon: Pencil });
    if (this.canEditNumber(inv)) acciones.push({ id: 'editNumber', label: 'Cambiar número', icon: Hash });
    if (inv.pdfUrl) {
      acciones.push({ id: 'download', label: 'Descargar PDF', icon: Download });
      acciones.push({ id: 'copyLink', label: 'Copiar enlace PDF', icon: Link });
    }
    if (this.canMarkPaid(inv)) acciones.push({ id: 'markPaid', label: 'Marcar como pagada', icon: CircleDollarSign });
    if (this.canFinalize(inv)) acciones.push({ id: 'finalize', label: 'Finalizar borrador', icon: CheckCircle2 });
    if (this.canRectify(inv)) acciones.push({ id: 'rectify', label: 'Crear rectificativa', icon: RotateCcw });
    if (this.canRetryVerifactu(inv)) {
      acciones.push({ id: 'retry', label: 'Reintentar envío a Verifactu', icon: RefreshCw });
    }
    if (this.canAnular(inv)) acciones.push({ id: 'anular', label: 'Anular factura', icon: Ban, danger: true });
    return acciones;
  }

  /** Despacha la acción elegida en el menú a los mismos handlers/outputs que los botones de escritorio. */
  ejecutarAccion(inv: Invoice, id: string): void {
    switch (id) {
      case 'edit': this.editInvoice.emit(inv); break;
      case 'editNumber': this.editNumber.emit(inv); break;
      case 'download': this.downloadPdf.emit(inv.id); break;
      case 'copyLink': this.copyPdfLink.emit(inv.id); break;
      case 'markPaid': this.markPaid.emit(inv.id); break;
      case 'finalize': this.finalizeDraft.emit(inv.id); break;
      case 'rectify': this.createRectificativa.emit(inv); break;
      case 'retry': this.reintentar(inv); break;
      case 'anular': this.anularFactura.emit(inv.id); break;
    }
  }
}
