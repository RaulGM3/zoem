import { Component, signal, computed, inject, OnInit, effect, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, Validators } from '@angular/forms';
import { LucideAngularModule, Settings, Plus } from 'lucide-angular';
import type { Invoice, InvoiceLinea } from '../../core/services/invoice.service';
import { CasosService } from '../../core/services/casos.service';
import { UsersService } from '../../core/services/users';
import { InvoiceService } from '../../core/services/invoice.service';
import type { InvoiceFormPayload } from './components/factura-drawer/factura-drawer';
import { InvoicePdfService } from '../../core/services/invoice-pdf.service';
import { CompanyService, getLabelIdentificacion } from '../../core/services/company.service';
import { ContactService } from '../../core/services/contact.service';
import type { Contact } from '../../interfaces/contact.interface';
import {
  clienteDesdeContacto,
  clienteDesdeFactura,
  escribirClienteEnContacto,
  type ClienteFactura,
} from '../../core/facturacion/cliente-factura';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { Caso, gestoriaCompleta, Hito } from '../../interfaces';
import type { ConfigFormGroup } from './components/facturacion-configuracion-tab/facturacion-configuracion-tab';
import type { HoraFlat } from './components/facturacion-horas-tab/facturacion-horas-tab';
import { FacturacionKpiCardsComponent } from './components/facturacion-kpi-cards/facturacion-kpi-cards';
import { FacturacionCasosTabComponent } from './components/facturacion-casos-tab/facturacion-casos-tab';
import { FacturacionArchivoTabComponent } from './components/facturacion-archivo-tab/facturacion-archivo-tab';
import { FacturacionHorasTabComponent } from './components/facturacion-horas-tab/facturacion-horas-tab';
import { FacturacionConfiguracionTabComponent } from './components/facturacion-configuracion-tab/facturacion-configuracion-tab';
import { FacturaDrawerComponent } from './components/factura-drawer/factura-drawer';
import { CierreModalComponent } from './components/cierre-modal/cierre-modal';

import { FacturacionFacturasTabComponent } from './components/facturacion-facturas-tab/facturacion-facturas-tab';
import { EditarNumeroModalComponent } from './components/editar-numero-modal/editar-numero-modal';
import { normalizeLinea } from '../../core/services/invoice.service';
import { IVA_LINEA_NUEVA } from '../../interfaces/iva';

type FacturacionTab = 'casos' | 'archivo' | 'facturas' | 'horas' | 'configuracion';

@Component({
  selector: 'app-facturacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    FacturacionKpiCardsComponent,
    FacturacionCasosTabComponent,
    FacturacionArchivoTabComponent,
    FacturacionHorasTabComponent,
    FacturacionConfiguracionTabComponent,
    FacturaDrawerComponent,
    CierreModalComponent,
    FacturacionFacturasTabComponent,
    EditarNumeroModalComponent,
  ],
  templateUrl: './facturacion.html',
})
export class FacturacionComponent implements OnInit {
  private readonly casosService = inject(CasosService);
  private readonly usersService = inject(UsersService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly invoicePdfService = inject(InvoicePdfService);
  protected readonly companyService = inject(CompanyService);
  private readonly contactService = inject(ContactService);
  private readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly SettingsIcon = Settings;
  readonly PlusIcon = Plus;

  activeTab = signal<FacturacionTab>('casos');

  // --- Config ---
  readonly savingConfig = signal(false);

  readonly cifLabel = computed(() => {
    const c = this.companyService.activeCompany();
    return c ? getLabelIdentificacion(c) : 'CIF / NIF';
  });

  readonly configForm: ConfigFormGroup = this.fb.nonNullable.group({
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
          verifactu: { ...company.verifactu, enabled: verifactuEnabled, sandbox: verifactuSandbox },
        }),
        { successMessage: 'Configuración guardada', errorTitle: 'No se pudo guardar la configuración' }
      );
    } finally {
      this.savingConfig.set(false);
    }
  }

  // --- Casos ---
  private readonly casos = this.casosService.casos;
  readonly loading = this.casosService.loading;
  readonly saving = signal(false);

  readonly casosAbiertos = computed(() =>
    this.casos().filter(c => c.estado !== 'cerrado' && c.estado !== 'archivado')
  );
  readonly casosArchivados = computed(() =>
    this.casos().filter(c => c.estado === 'cerrado' || c.estado === 'archivado')
  );

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

  readonly canCreateFactura = computed(() => this.perm.can('Facturación', 'crear'));
  readonly canEditCasos = computed(() => this.perm.can('Casos', 'editar'));

  readonly invoiceMap = computed(() =>
    new Map<string, Invoice>(this.invoiceService.invoices().map(i => [i.id, i]))
  );

  // --- Drawer state ---
  readonly facturaCaso = signal<Caso | null>(null);
  readonly drawerLineas = signal<InvoiceLinea[]>([]);
  readonly drawerEditMode = signal(false);
  readonly drawerEditingInvoice = signal<Invoice | null>(null);
  readonly drawerNotes = signal('');
  readonly drawerStandalone = signal(false);
  readonly drawerRectificativa = signal(false);
  /** Cliente con el que se precarga la sección Cliente del drawer, y contacto del que viene (si lo hay). */
  readonly drawerCliente = signal<ClienteFactura | null>(null);
  readonly drawerContacto = signal<Contact | null>(null);
  /** Clientes del caso (los que siguen existiendo), para elegir de cuál se saca el NIF. */
  readonly drawerContactosCaso = signal<Contact[]>([]);
  /** Contactos para el buscador del drawer (se cargan la primera vez que se busca). */
  readonly contactos = this.contactService.contacts;

  /** Carga los contactos si aún no están; un fallo se avisa y el cliente puede escribirse a mano. */
  async cargarContactos(): Promise<void> {
    if (this.contactService.contacts().length > 0 || this.contactService.isLoading()) return;
    await this.toast.run(() => this.contactService.loadContacts(), { errorTitle: 'No se pudieron cargar los contactos' });
  }

  /**
   * "Guardar también en el contacto": se ejecuta con la factura YA guardada (es la copia legal) y
   * es best-effort: si falla se avisa, pero la factura no se revierte.
   */
  private async guardarClienteEnContacto(payload: InvoiceFormPayload): Promise<void> {
    if (!payload.guardarEnContacto) return;
    await this.toast.run(
      () => escribirClienteEnContacto(this.contactService, { guardar: true, cliente: payload.cliente }),
      { errorTitle: 'La factura se guardó, pero no se pudo actualizar el contacto' },
    );
  }

  readonly drawerIssueDate = computed(() => new Date().toISOString().slice(0, 10));
  readonly drawerDueDate = computed(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  abrirFactura(caso: Caso): void {
    const r = caso.resumenFinanciero;
    this.drawerLineas.set(
      [
        { concepto: 'Honorarios', descripcion: '', cantidad: 1, precioUnitario: r.totalHonorarios, base: r.totalHonorarios, aplicaIva: true, ivaRate: IVA_LINEA_NUEVA },
        { concepto: 'Suplidos', descripcion: '', cantidad: 1, precioUnitario: r.totalSuplidos, base: r.totalSuplidos, aplicaIva: false },
        { concepto: 'Ingresos', descripcion: '', cantidad: 1, precioUnitario: r.totalIngresos, base: r.totalIngresos, aplicaIva: false },
      ].filter(l => l.precioUnitario > 0),
    );
    this.drawerEditMode.set(false);
    this.drawerEditingInvoice.set(null);
    this.drawerNotes.set('');
    this.drawerStandalone.set(false);
    this.drawerRectificativa.set(false);
    this.drawerCliente.set(null);
    this.drawerContacto.set(null);
    this.drawerContactosCaso.set([]);
    this.facturaCaso.set(caso);
    void this.precargarContactosCaso(caso.contactoIds ?? [], () => this.facturaCaso() === caso);
  }

  /**
   * Resuelve en segundo plano TODOS los contactos del caso y precarga la sección Cliente con el
   * primero que siga existiendo. `contactoIds` puede conservar ids de contactos borrados (el
   * detalle del caso los oculta), así que no basta con mirar el primero. `sigueAbierto` evita
   * aplicar un resultado tardío a un drawer que ya se cerró o se reabrió para otra factura.
   * Si ninguno se puede leer no se impide facturar: el cliente se escribe a mano.
   */
  private async precargarContactosCaso(contactoIds: string[], sigueAbierto: () => boolean): Promise<void> {
    if (contactoIds.length === 0) return;
    const leidos = await Promise.all(
      contactoIds.map((id) => this.contactService.getContact(id).catch(() => null)),
    );
    const perdidos = contactoIds.filter((_, i) => !leidos[i]);
    if (perdidos.length > 0) {
      console.warn(`Contactos del caso no disponibles (borrados o sin acceso): ${perdidos.join(', ')}`);
    }
    if (!sigueAbierto()) return;
    const contactos = leidos.filter((c): c is Contact => c !== null);
    this.drawerContactosCaso.set(contactos);
    const [primero] = contactos;
    if (!primero) return;
    this.drawerContacto.set(primero);
    this.drawerCliente.set(clienteDesdeContacto(primero));
  }

  /** Abre el drawer para crear una factura standalone (sin caso). */
  abrirFacturaStandalone(): void {
    this.drawerLineas.set([]);
    this.drawerEditMode.set(false);
    this.drawerEditingInvoice.set(null);
    this.drawerNotes.set('');
    this.drawerStandalone.set(true);
    this.drawerRectificativa.set(false);
    this.drawerCliente.set(null);
    this.drawerContacto.set(null);
    this.drawerContactosCaso.set([]);
    // Usamos un Caso "fantasma" para abrir el drawer — el drawer solo lee titulo
    this.facturaCaso.set({ id: '', titulo: 'Factura libre' } as Caso);
  }

  abrirEdicion(invoice: Invoice): void {
    const lineas = (invoice.lineas ?? []).map(l => normalizeLinea(l));
    this.drawerLineas.set(lineas);
    this.drawerEditMode.set(true);
    this.drawerEditingInvoice.set(invoice);
    this.drawerNotes.set(invoice.notes ?? '');
    this.drawerStandalone.set(false);
    this.drawerRectificativa.set(false);
    // La factura conserva su propia copia del cliente: se precarga el snapshot, no el contacto.
    this.drawerCliente.set(clienteDesdeFactura(invoice));
    this.drawerContacto.set(null);
    this.drawerContactosCaso.set([]);
    const caso = { id: invoice.casoId ?? '', titulo: invoice.casoTitulo ?? invoice.invoiceNumber } as Caso;
    this.facturaCaso.set(caso);
    void this.precargarContactoVinculado(invoice.clienteContactoId, () => this.facturaCaso() === caso);
  }

  /** Solo vincula el contacto (para poder desvincularlo); no pisa el snapshot de la factura. */
  private async precargarContactoVinculado(contactoId: string | undefined, sigueAbierto: () => boolean): Promise<void> {
    if (!contactoId) return;
    const contacto = await this.contactService.getContact(contactoId).catch(() => null);
    if (contacto && sigueAbierto()) this.drawerContacto.set(contacto);
  }

  cerrarFacturaDrawer(): void {
    this.facturaCaso.set(null);
    this.drawerEditMode.set(false);
    this.drawerEditingInvoice.set(null);
    this.drawerStandalone.set(false);
    this.drawerRectificativa.set(false);
    this.drawerCliente.set(null);
    this.drawerContacto.set(null);
    this.drawerContactosCaso.set([]);
  }

  async confirmarFactura(payload: InvoiceFormPayload): Promise<void> {
    const caso = this.facturaCaso();
    if (!caso || this.saving()) return;

    // Edit mode: update existing invoice
    const editingInvoice = this.drawerEditingInvoice();
    if (this.drawerEditMode() && editingInvoice) {
      this.saving.set(true);
      let guardada = false;
      try {
        await this.toast.run(
          () => this.invoiceService.updateInvoiceContent(
            editingInvoice.id,
            payload.lineas.filter(l => l.base !== 0),
            payload.ivaRate,
            payload.issueDate,
            payload.dueDate,
            payload.notes || undefined,
            payload.cliente,
          ),
          {
            successMessage: 'Factura actualizada',
            errorTitle: 'No se pudo actualizar la factura',
            onSuccess: () => {
              guardada = true;
              this.cerrarFacturaDrawer();
            },
          }
        );
        if (guardada) await this.guardarClienteEnContacto(payload);
      } finally {
        this.saving.set(false);
      }
      return;
    }

    // Rectificativa mode
    if (this.drawerRectificativa()) {
      const originalInvoice = this.drawerEditingInvoice();
      if (!originalInvoice) return;
      this.saving.set(true);
      try {
        await this.toast.run(
          () => this.invoiceService.createRectificativa(
            originalInvoice.id,
            payload.lineas.filter(l => l.base !== 0),
            payload.ivaRate,
            payload.issueDate,
            payload.dueDate,
            payload.notes || undefined,
          ),
          {
            successMessage: 'Factura rectificativa creada',
            errorTitle: 'No se pudo crear la rectificativa',
            onSuccess: () => this.cerrarFacturaDrawer(),
          }
        );
      } finally {
        this.saving.set(false);
      }
      return;
    }

    // Create mode: new invoice
    this.saving.set(true);
    try {
      const isStandalone = this.drawerStandalone();
      const lineas = payload.lineas.filter(l => l.base !== 0);

      if (isStandalone) {
        // Standalone invoice — no caso
        let guardada = false;
        await this.toast.run(
          () => this.invoiceService.createStandaloneInvoice(
            lineas,
            payload.ivaRate,
            payload.issueDate,
            payload.dueDate,
            payload.notes || undefined,
            payload.cliente,
          ),
          {
            successMessage: 'Factura creada',
            errorTitle: 'No se pudo crear la factura',
            onSuccess: () => {
              guardada = true;
              this.cerrarFacturaDrawer();
            },
          }
        );
        if (guardada) await this.guardarClienteEnContacto(payload);
      } else {
        // Invoice linked to a caso
        const facturaId = await this.toast.run(
          () => this.invoiceService.createInvoiceForCaso(
            caso.id,
            lineas,
            payload.ivaRate,
            payload.issueDate,
            payload.dueDate,
            payload.notes || undefined,
            caso.titulo,
            payload.cliente,
          ),
          { errorTitle: 'No se pudo generar la factura' }
        );
        if (facturaId === undefined) return;
        await this.guardarClienteEnContacto(payload);
        await this.toast.run(() => this.casosService.marcarFacturado(caso.id, facturaId), {
          successMessage: 'Factura generada',
          errorTitle: 'La factura se creó pero no se pudo marcar el caso como facturado',
          onSuccess: () => this.cerrarFacturaDrawer(),
        });
      }
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
    return !!caso && gestoriaCompleta(caso) && this.movimientosOk() && this.bancoOk();
  });

  abrirCierre(caso: Caso): void {
    if (!gestoriaCompleta(caso)) {
      const r = caso.gestoriaResumenSlots;
      const motivo = !r || r.total === 0
        ? 'este caso no tiene costos de gestoría previstos'
        : `faltan ${r.total - r.registrados} de ${r.total} costos de gestoría por registrar`;
      console.warn('[Facturación] abrirCierre bloqueado', { casoId: caso.id, motivo });
      this.toast.info(`No se puede cerrar el caso: ${motivo}.`, 'Cierre no disponible');
      return;
    }
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
  downloadPdf(facturaId: string | undefined): void {
    if (!facturaId) return;
    const invoice = this.invoiceMap().get(facturaId);
    if (!invoice?.pdfUrl) return;
    this.invoicePdfService.downloadFromUrl(invoice.pdfUrl, `${invoice.invoiceNumber ?? 'factura'}.pdf`);
  }

  async copyPdfLink(facturaId: string | undefined): Promise<void> {
    if (!facturaId) return;
    const url = this.invoiceMap().get(facturaId)?.pdfUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    this.toast.success('Link copiado al portapapeles');
  }

  // --- Registro de Horas ---
  private readonly allHitos = signal<Hito[]>([]);

  readonly horasFlat = computed<HoraFlat[]>(() => {
    const membersMap = new Map(this.usersService.members().map(m => [m.userId, m]));
    const result: HoraFlat[] = [];
    for (const hito of this.allHitos()) {
      for (const r of hito.registrosHoras ?? []) {
        const member = membersMap.get(r.userId);
        const horas = r.minutos / 60;
        const tarifa = member?.tarifaHoraria;
        result.push({
          id: `${hito.id}::${r.id}`,
          casoId: hito.casoId,
          casoTitulo: hito.casoTitulo,
          hitoId: hito.id,
          hitoTitulo: hito.titulo,
          memberName: member ? `${member.nombre}${member.apellido ? ' ' + member.apellido : ''}` : r.userId,
          fecha: r.fecha,
          minutos: r.minutos,
          horas,
          facturado: r.facturado ?? false,
          ...(tarifa ? { importe: tarifa * horas } : {}),
        });
      }
    }
    return result.sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  readonly totalHoras = computed(() => this.horasFlat().reduce((s, h) => s + h.horas, 0));
  readonly horasPendientes = computed(() => this.horasFlat().filter(h => !h.facturado).reduce((s, h) => s + h.horas, 0));
  readonly valorPendiente = computed(() => this.horasFlat().filter(h => !h.facturado && h.importe !== undefined).reduce((s, h) => s + (h.importe ?? 0), 0));

  // --- Facturas tab actions ---
  readonly allInvoices = this.invoiceService.invoices;
  readonly invoicesLoading = this.invoiceService.isLoading;

  async handleMarkPaid(invoiceId: string): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.toast.run(
        () => this.invoiceService.markAsPaid(invoiceId),
        { successMessage: 'Factura marcada como pagada', errorTitle: 'No se pudo actualizar la factura' }
      );
    } finally {
      this.saving.set(false);
    }
  }

  async handleFinalizeDraft(invoiceId: string): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.toast.run(
        () => this.invoiceService.finalizeDraft(invoiceId),
        { successMessage: 'Borrador finalizado', errorTitle: 'No se pudo finalizar el borrador' }
      );
    } finally {
      this.saving.set(false);
    }
  }

  async handleRetryVerifactu(invoiceId: string): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.toast.run(
        () => this.invoiceService.retryVerifactu(invoiceId),
        { successMessage: 'Reenvío a Verifactu iniciado', errorTitle: 'No se pudo reintentar el envío' }
      );
    } finally {
      this.saving.set(false);
    }
  }

  // --- Cambio manual del número de factura ---
  readonly editandoNumeroInvoice = signal<Invoice | null>(null);

  /** Números ya usados por el resto de facturas, para avisar de duplicados en el modal. */
  readonly numerosEnUso = computed(() => {
    const actual = this.editandoNumeroInvoice();
    return this.allInvoices()
      .filter(i => i.id !== actual?.id)
      .map(i => i.invoiceNumber);
  });

  abrirEditarNumero(invoice: Invoice): void {
    this.editandoNumeroInvoice.set(invoice);
  }

  cerrarEditarNumero(): void {
    this.editandoNumeroInvoice.set(null);
  }

  async handleUpdateInvoiceNumber(nuevoNumero: string): Promise<void> {
    const invoice = this.editandoNumeroInvoice();
    if (!invoice || this.saving()) return;
    this.saving.set(true);
    try {
      await this.toast.run(
        () => this.invoiceService.updateInvoiceNumber(invoice.id, nuevoNumero),
        {
          successMessage: 'Número de factura actualizado',
          errorTitle: 'No se pudo cambiar el número de la factura',
          onSuccess: () => this.cerrarEditarNumero(),
        }
      );
    } finally {
      this.saving.set(false);
    }
  }

  async handleAnularFactura(invoiceId: string): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.toast.run(
        () => this.invoiceService.anularFactura(invoiceId),
        { successMessage: 'Factura anulada', errorTitle: 'No se pudo anular la factura' }
      );
    } finally {
      this.saving.set(false);
    }
  }

  /** Abre el drawer para crear una rectificativa de una factura existente. */
  abrirRectificativa(invoice: Invoice): void {
    // Pre-populate with negated lines from the original
    const lineas = (invoice.lineas ?? []).map(l => normalizeLinea({
      ...l,
      precioUnitario: -l.precioUnitario,
      base: -(l.base ?? l.cantidad * l.precioUnitario),
    }));
    this.drawerLineas.set(lineas);
    this.drawerEditMode.set(false);
    this.drawerEditingInvoice.set(invoice); // reference to original for rectificativa
    this.drawerNotes.set(`Rectificativa de ${invoice.invoiceNumber}`);
    this.drawerStandalone.set(false);
    this.drawerRectificativa.set(true);
    // La rectificativa hereda el cliente de la original (lo copia el servicio).
    this.drawerCliente.set(clienteDesdeFactura(invoice));
    this.drawerContacto.set(null);
    this.drawerContactosCaso.set([]);
    this.facturaCaso.set({ id: invoice.casoId ?? '', titulo: invoice.casoTitulo ?? invoice.invoiceNumber } as Caso);
  }

  downloadPdfById(invoiceId: string): void {
    this.downloadPdf(invoiceId);
  }

  async copyPdfLinkById(invoiceId: string): Promise<void> {
    await this.copyPdfLink(invoiceId);
  }

  navigateToCaso(id: string): void {
    this.router.navigate(['/casos', id]);
  }

  async reabrirCaso(caso: Caso): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.toast.run(
        () => this.casosService.updateCaso(caso.id, { estado: 'en_proceso' }),
        { successMessage: 'Caso reabierto', errorTitle: 'No se pudo reabrir el caso' }
      );
    } finally {
      this.saving.set(false);
    }
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.casosService.loadCasos(),
      this.invoiceService.loadInvoices(),
      this.usersService.loadMembers(),
      this.casosService.loadAllHitos().then(h => this.allHitos.set(h)),
    ]);
  }
}
