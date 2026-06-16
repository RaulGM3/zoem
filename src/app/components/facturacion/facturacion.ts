import { Component, signal, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import {
  LucideAngularModule,
  Receipt, Search, Plus, TrendingUp, Clock, CheckCircle2,
  AlertCircle, Download, Send, Eye, MoreHorizontal, Euro,
  FileText, ShieldCheck, ExternalLink, Timer, X, Archive, FileCheck,
} from 'lucide-angular';
import { REGISTRO_HORAS } from '../../data/dummy-data';
import { CasosService } from '../../core/services/casos.service';
import { InvoiceService, InvoiceLinea } from '../../core/services/invoice.service';
import { CompanyService } from '../../core/services/company.service';
import { Caso, gestoriaCompleta } from '../../interfaces';

type FacturacionTab = 'casos' | 'archivo' | 'fiscal' | 'horas';

const MODELOS_FISCALES = [
  { modelo: 'Modelo 303', descripcion: 'IVA — 2º Trimestre 2026', estado: 'pendiente', importe: 3240, vencimiento: '20 Jul 2026' },
  { modelo: 'Modelo 130', descripcion: 'IRPF fraccionado — 2T 2026', estado: 'pendiente', importe: 1180, vencimiento: '20 Jul 2026' },
  { modelo: 'Modelo 111', descripcion: 'Retenciones IRPF — 2T 2026', estado: 'borrador', importe: 890, vencimiento: '20 Jul 2026' },
  { modelo: 'Modelo 303', descripcion: 'IVA — 1º Trimestre 2026', estado: 'presentado', importe: 2980, vencimiento: '20 Abr 2026' },
];

@Component({
  selector: 'app-facturacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe, SlicePipe],
  templateUrl: './facturacion.html',
})
export class FacturacionComponent implements OnInit {
  private readonly casosService = inject(CasosService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly companyService = inject(CompanyService);

  readonly ReceiptIcon = Receipt;
  readonly SearchIcon = Search;
  readonly PlusIcon = Plus;
  readonly TrendingUpIcon = TrendingUp;
  readonly ClockIcon = Clock;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly AlertCircleIcon = AlertCircle;
  readonly DownloadIcon = Download;
  readonly SendIcon = Send;
  readonly EyeIcon = Eye;
  readonly MoreHorizontalIcon = MoreHorizontal;
  readonly EuroIcon = Euro;
  readonly FileTextIcon = FileText;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly ExternalLinkIcon = ExternalLink;
  readonly TimerIcon = Timer;
  readonly XIcon = X;
  readonly ArchiveIcon = Archive;
  readonly FileCheckIcon = FileCheck;

  activeTab = signal<FacturacionTab>('casos');

  // --- Casos (fuente real desde Firestore) ---
  private readonly casos = this.casosService.casos;
  readonly loading = this.casosService.loading;
  readonly saving = signal(false);

  readonly casosAbiertos = computed(() =>
    this.casos().filter(c => c.estado !== 'cerrado' && c.estado !== 'archivado')
  );
  readonly casosArchivados = computed(() =>
    this.casos().filter(c => c.estado === 'cerrado' || c.estado === 'archivado')
  );

  // Totales globales (sumatoria de la gestoría de los casos abiertos).
  readonly totales = computed(() =>
    this.casosAbiertos().reduce(
      (acc, c) => {
        const r = c.resumenFinanciero;
        acc.ingresos += r.totalIngresos;
        acc.suplidos += r.totalSuplidos;
        acc.honorarios += r.totalHonorarios;
        acc.saldo += r.saldo;
        return acc;
      },
      { ingresos: 0, suplidos: 0, honorarios: 0, saldo: 0 }
    )
  );

  esEjecutado(caso: Caso): boolean {
    return gestoriaCompleta(caso);
  }

  slotsLabel(caso: Caso): string {
    const r = caso.gestoriaResumenSlots;
    if (!r || r.total === 0) return 'Sin costos previstos';
    return `${r.registrados}/${r.total} registrados`;
  }

  // --- Drawer: Generar factura ---
  readonly facturaCaso = signal<Caso | null>(null);
  readonly lineas = signal<InvoiceLinea[]>([]);
  readonly ivaRate = signal(21);

  readonly facturaPreview = computed(() => {
    const rate = this.ivaRate() / 100;
    const base = this.lineas().reduce((s, l) => s + (Number(l.base) || 0), 0);
    const iva = this.lineas().reduce((s, l) => s + (l.aplicaIva ? (Number(l.base) || 0) * rate : 0), 0);
    return { base, iva, total: base + iva };
  });

  abrirFactura(caso: Caso): void {
    const r = caso.resumenFinanciero;
    this.lineas.set([
      { concepto: 'Honorarios', base: r.totalHonorarios, aplicaIva: true },
      { concepto: 'Suplidos', base: r.totalSuplidos, aplicaIva: false },
      { concepto: 'Ingresos', base: r.totalIngresos, aplicaIva: false },
    ]);
    this.ivaRate.set(21);
    this.facturaCaso.set(caso);
  }

  cerrarFacturaDrawer(): void {
    this.facturaCaso.set(null);
  }

  setLineaBase(index: number, value: string): void {
    const base = Number(value) || 0;
    this.lineas.update(list => list.map((l, i) => (i === index ? { ...l, base } : l)));
  }

  toggleLineaIva(index: number): void {
    this.lineas.update(list => list.map((l, i) => (i === index ? { ...l, aplicaIva: !l.aplicaIva } : l)));
  }

  setIvaRate(value: string): void {
    this.ivaRate.set(Number(value) || 0);
  }

  async confirmarFactura(): Promise<void> {
    const caso = this.facturaCaso();
    if (!caso || this.saving()) return;
    this.saving.set(true);
    try {
      const facturaId = await this.invoiceService.createInvoiceForCaso(
        caso.id,
        this.lineas().filter(l => l.base !== 0),
        this.ivaRate() / 100
      );
      await this.casosService.marcarFacturado(caso.id, facturaId);
      this.cerrarFacturaDrawer();
    } finally {
      this.saving.set(false);
    }
  }

  // --- Modal: Cerrar caso ---
  readonly cierreCaso = signal<Caso | null>(null);
  readonly movimientosOk = signal(false);
  readonly bancoOk = signal(false);

  readonly saldoBancario = computed(() => this.companyService.activeCompany()?.saldoBancario);

  readonly puedeCerrar = computed(() => {
    const caso = this.cierreCaso();
    return !!caso && this.esEjecutado(caso) && this.movimientosOk() && this.bancoOk();
  });

  abrirCierre(caso: Caso): void {
    this.movimientosOk.set(false);
    this.bancoOk.set(false);
    this.cierreCaso.set(caso);
  }

  cerrarCierreModal(): void {
    this.cierreCaso.set(null);
  }

  async confirmarCierre(): Promise<void> {
    const caso = this.cierreCaso();
    if (!caso || !this.puedeCerrar() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.casosService.confirmarCierre(caso.id, { saldoBancario: this.saldoBancario() });
      this.cerrarCierreModal();
    } finally {
      this.saving.set(false);
    }
  }

  // --- Tabs mock (fuera de alcance) ---
  registroHoras = REGISTRO_HORAS;
  modelosFiscales = MODELOS_FISCALES;

  totalHoras = computed(() => this.registroHoras.reduce((s, h) => s + h.horas, 0));
  horasPendientes = computed(() =>
    this.registroHoras.filter(h => h.estadoFacturacion === 'pendiente').reduce((s, h) => s + h.horas, 0)
  );

  getModeloEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'bg-amber-100 text-amber-700',
      presentado: 'bg-green-100 text-green-700',
      borrador: 'bg-slate-100 text-slate-500',
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }

  getHoraEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      facturado: 'bg-green-100 text-green-700',
      pendiente: 'bg-amber-100 text-amber-700',
      no_facturable: 'bg-slate-100 text-slate-500',
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.casosService.loadCasos(),
      this.invoiceService.loadInvoices(),
    ]);
  }
}
