import { Component, signal, computed, inject, OnInit, effect, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  Receipt, Search, Plus, TrendingUp, Clock, CheckCircle2,
  AlertCircle, Download, Send, Eye, MoreHorizontal, Euro,
  FileText, ShieldCheck, ShieldAlert, ShieldX, ExternalLink, Timer, X, Archive, FileCheck, Link,
  Settings, Save, Building2,
} from 'lucide-angular';
import type { VerifactuEstado } from '../../interfaces/verifactu.interface';
import type { Invoice } from '../../core/services/invoice.service';
import { REGISTRO_HORAS } from '../../data/dummy-data';
import { CasosService } from '../../core/services/casos.service';
import { InvoiceService, InvoiceLinea } from '../../core/services/invoice.service';
import { InvoicePdfService } from '../../core/services/invoice-pdf.service';
import { CompanyService, getLabelIdentificacion } from '../../core/services/company.service';
import { ContactService } from '../../core/services/contact.service';
import { getContactDisplayName, type Contact, type Direccion } from '../../interfaces/contact.interface';

function getContactNif(c: Contact): string | undefined {
  return c.type === 'persona_fisica' ? c.nif : c.cif;
}

function getContactDireccion(c: Contact): string | undefined {
  const d: Direccion | undefined = c.type === 'persona_fisica' ? c.direccion : (c.direccionFiscal ?? c.direccionSocial);
  if (!d) return undefined;
  return [d.calle, d.numero, d.piso, d.codigoPostal, d.municipio, d.provincia].filter(Boolean).join(', ');
}
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { CredencialesAeatComponent } from '../credenciales-aeat/credenciales-aeat';
import { Caso, gestoriaCompleta } from '../../interfaces';

type FacturacionTab = 'casos' | 'archivo' | 'fiscal' | 'horas' | 'configuracion';

const MODELOS_FISCALES = [
  { modelo: 'Modelo 303', descripcion: 'IVA — 2º Trimestre 2026', estado: 'pendiente', importe: 3240, vencimiento: '20 Jul 2026' },
  { modelo: 'Modelo 130', descripcion: 'IRPF fraccionado — 2T 2026', estado: 'pendiente', importe: 1180, vencimiento: '20 Jul 2026' },
  { modelo: 'Modelo 111', descripcion: 'Retenciones IRPF — 2T 2026', estado: 'borrador', importe: 890, vencimiento: '20 Jul 2026' },
  { modelo: 'Modelo 303', descripcion: 'IVA — 1º Trimestre 2026', estado: 'presentado', importe: 2980, vencimiento: '20 Abr 2026' },
];

@Component({
  selector: 'app-facturacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe, SlicePipe, ReactiveFormsModule, CredencialesAeatComponent],
  templateUrl: './facturacion.html',
})
export class FacturacionComponent implements OnInit {
  private readonly casosService = inject(CasosService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly invoicePdfService = inject(InvoicePdfService);
  protected readonly companyService = inject(CompanyService);
  private readonly contactService = inject(ContactService);
  readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

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
  readonly ShieldAlertIcon = ShieldAlert;
  readonly ShieldXIcon = ShieldX;
  readonly ExternalLinkIcon = ExternalLink;
  readonly TimerIcon = Timer;
  readonly XIcon = X;
  readonly ArchiveIcon = Archive;
  readonly FileCheckIcon = FileCheck;
  readonly LinkIcon = Link;
  readonly SettingsIcon = Settings;
  readonly SaveIcon = Save;
  readonly Building2Icon = Building2;

  activeTab = signal<FacturacionTab>('casos');

  // --- Config: datos de facturación ---
  readonly savingConfig = signal(false);

  readonly cifLabel = computed(() => {
    const c = this.companyService.activeCompany();
    return c ? getLabelIdentificacion(c) : 'CIF / NIF';
  });

  readonly configForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    cif: [''],
    tipoPersona: ['juridica' as 'fisica' | 'juridica'],
    verifactuEnabled: [false],
    verifactuSandbox: [false],
  });

  constructor() {
    effect(() => {
      const c = this.companyService.activeCompany();
      if (c) {
        this.configForm.patchValue({
          name: c.name,
          cif: c.cif ?? '',
          tipoPersona: c.tipoPersona ?? 'juridica',
          verifactuEnabled: c.verifactu?.enabled ?? false,
          verifactuSandbox: c.verifactu?.sandbox ?? false,
        }, { emitEvent: false });
      }
    });
  }

  async saveConfig(): Promise<void> {
    const company = this.companyService.activeCompany();
    if (!company?.id || this.savingConfig()) return;
    const { name, cif, tipoPersona, verifactuEnabled, verifactuSandbox } = this.configForm.getRawValue();
    this.savingConfig.set(true);
    try {
      await this.toast.run(
        () => this.companyService.updateCompany(company.id, {
          name: name.trim(),
          cif: cif.trim() || undefined,
          tipoPersona,
          verifactu: {
            ...company.verifactu,
            enabled: verifactuEnabled,
            sandbox: verifactuSandbox,
          },
        }),
        { successMessage: 'Configuración guardada', errorTitle: 'No se pudo guardar la configuración' }
      );
    } finally {
      this.savingConfig.set(false);
    }
  }

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
      const contactoId = caso.contactoIds?.[0];
      let cliente: { nombre: string; nif?: string; direccion?: string } | undefined;
      if (contactoId) {
        const c = await this.contactService.getContact(contactoId).catch(() => null);
        if (c) cliente = { nombre: getContactDisplayName(c), nif: getContactNif(c), direccion: getContactDireccion(c) };
      }

      const facturaId = await this.toast.run(
        () => this.invoiceService.createInvoiceForCaso(
          caso.id,
          this.lineas().filter(l => l.base !== 0),
          this.ivaRate() / 100,
          caso.titulo,
          cliente,
        ),
        { errorTitle: 'No se pudo generar la factura' }
      );
      if (facturaId === undefined) return; // falló: el toast ya avisó
      await this.toast.run(() => this.casosService.marcarFacturado(caso.id, facturaId), {
        successMessage: 'Factura generada',
        errorTitle: 'La factura se creó pero no se pudo marcar el caso como facturado',
        onSuccess: () => this.cerrarFacturaDrawer(),
      });
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
      await this.toast.run(
        () => this.casosService.confirmarCierre(caso.id, { saldoBancario: this.saldoBancario() }),
        {
          successMessage: 'Caso cerrado',
          errorTitle: 'No se pudo cerrar el caso',
          onSuccess: () => this.cerrarCierreModal(),
        }
      );
    } finally {
      this.saving.set(false);
    }
  }

  // --- PDF actions ---
  pdfUrl(facturaId: string | undefined): string | undefined {
    if (!facturaId) return undefined;
    return this.invoiceMap().get(facturaId)?.pdfUrl;
  }

  downloadPdf(facturaId: string | undefined): void {
    const url = this.pdfUrl(facturaId);
    if (!url) return;
    const invoice = this.invoiceMap().get(facturaId!);
    this.invoicePdfService.downloadFromUrl(url, `${invoice?.invoiceNumber ?? 'factura'}.pdf`);
  }

  async copyPdfLink(facturaId: string | undefined): Promise<void> {
    const url = this.pdfUrl(facturaId);
    if (!url) return;
    await navigator.clipboard.writeText(url);
    this.toast.success('Link copiado al portapapeles');
  }

  // --- Verifactu helpers ---
  private readonly invoiceMap = computed(() =>
    new Map<string, Invoice>(this.invoiceService.invoices().map((i) => [i.id, i]))
  );

  verifactuEstado(facturaId?: string): VerifactuEstado | undefined {
    if (!facturaId) return undefined;
    return this.invoiceMap().get(facturaId)?.verifactu;
  }

  verifactuBadgeColor(facturaId?: string): string {
    const estado = this.verifactuEstado(facturaId)?.estado;
    if (estado === 'enviado') return 'var(--success)';
    if (estado === 'pendiente') return 'var(--warning)';
    if (estado === 'error') return 'var(--danger)';
    return 'var(--text-faint)';
  }

  verifactuBadgeIcon(facturaId?: string) {
    const estado = this.verifactuEstado(facturaId)?.estado;
    if (estado === 'enviado') return this.ShieldCheckIcon;
    if (estado === 'error') return this.ShieldXIcon;
    return this.ShieldAlertIcon;
  }

  // --- Tabs mock (fuera de alcance) ---
  registroHoras = REGISTRO_HORAS;
  modelosFiscales = MODELOS_FISCALES;

  totalHoras = computed(() => this.registroHoras.reduce((s, h) => s + h.horas, 0));
  horasPendientes = computed(() =>
    this.registroHoras.filter(h => h.estadoFacturacion === 'pendiente').reduce((s, h) => s + h.horas, 0)
  );

  getModeloEstadoColor(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'var(--warning)',
      presentado: 'var(--success)',
      borrador: 'var(--text-muted)',
    };
    return map[estado] || 'var(--text-muted)';
  }

  getHoraEstadoColor(estado: string): string {
    const map: Record<string, string> = {
      facturado: 'var(--success)',
      pendiente: 'var(--warning)',
      no_facturable: 'var(--text-muted)',
    };
    return map[estado] || 'var(--text-muted)';
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.casosService.loadCasos(),
      this.invoiceService.loadInvoices(),
    ]);
  }
}
