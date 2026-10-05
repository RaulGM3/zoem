import { ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { LucideAngularModule, Ban, Plus, Info, Download, ShieldCheck, ExternalLink } from 'lucide-angular';
import { ActionMenuComponent, type MenuAction } from '../../../../shared/components/action-menu/action-menu';
import {
  ListCardDirective,
  ListTableDirective,
  ResponsiveListComponent,
} from '../../../../shared/components/responsive-list/responsive-list';
import {
  FacturaAnuladaExistenteError,
  FacturaDuplicadaError,
  FacturasRecibidasService,
  MovimientoNoEncontradoError,
  MovimientoYaVinculadoError,
} from '../../../../core/services/facturas-recibidas.service';
import { CompanyService } from '../../../../core/services/company.service';
import { GestoriaService } from '../../../../core/services/gestoria.service';
import { LibroRecibidasExportService } from '../../../../core/services/libro-recibidas-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import { resumen303 } from '../../../../core/facturas-recibidas/resumen303';
import { trimestre } from '../../../../core/facturas-recibidas/trimestre';
import type { FacturaRecibida, TrimestreIva } from '../../../../interfaces/factura-recibida.interface';
import {
  anuncioValidacionQr,
  mensajeErrorValidarQr,
  puedeValidarQr,
  vistaQrValidacion,
  type TonoQr,
  type VistaQrValidacion,
} from '../../../../core/facturas-recibidas/qr-validacion-ui';
import { fechaCorta } from '../../../../core/facturacion/fecha-corta';
import {
  FacturaRecibidaDrawerComponent,
  type FacturaRecibidaPayload,
} from '../factura-recibida-drawer/factura-recibida-drawer';

@Component({
  selector: 'app-facturacion-gastos-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule, DecimalPipe, NgTemplateOutlet, ActionMenuComponent, ResponsiveListComponent, ListCardDirective,
    ListTableDirective, FacturaRecibidaDrawerComponent,
  ],
  templateUrl: './facturacion-gastos-tab.html',
})
export class FacturacionGastosTabComponent implements OnInit, OnDestroy {
  private readonly service = inject(FacturasRecibidasService);
  private readonly toast = inject(ToastService);
  private readonly company = inject(CompanyService);
  private readonly gestoria = inject(GestoriaService);
  private readonly libro = inject(LibroRecibidasExportService);

  /** Fecha de hoy (`yyyy-MM-dd`): fija el periodo inicial y la fecha de registro propuesta. */
  readonly fechaHoy = input.required<string>();

  protected readonly BanIcon = Ban;
  protected readonly PlusIcon = Plus;
  protected readonly InfoIcon = Info;
  protected readonly DownloadIcon = Download;
  protected readonly ShieldCheckIcon = ShieldCheck;
  protected readonly ExternalLinkIcon = ExternalLink;
  protected readonly fechaCorta = fechaCorta;
  protected readonly trimestres: readonly TrimestreIva[] = [1, 2, 3, 4];

  protected readonly ejercicio = signal(0);
  protected readonly trimestreSel = signal<TrimestreIva>(1);
  protected readonly cargando = this.service.cargando;

  protected readonly drawerAbierto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly reactivacionPendiente = signal(false);
  protected readonly exportando = signal(false);
  /** Facturas con una validación de QR en curso (evita dobles llamadas al callable). */
  protected readonly validandoIds = signal<ReadonlySet<string>>(new Set());
  /** Errores del callable que no llegaron a persistirse en la factura (HttpsError), por id. */
  private readonly erroresQr = signal<Readonly<Record<string, string>>>({});
  /** Texto de la región `aria-live` única de la pestaña. */
  protected readonly anuncio = signal('');
  protected readonly movimientos = this.gestoria.todosMovimientos;
  /** El tab abrió la escucha de movimientos (el drawer los necesita para sugerir): debe cerrarla. */
  private escuchandoMovimientos = false;

  protected readonly delTrimestre = computed(() =>
    this.service
      .facturas()
      .filter((f) => f.periodo303.ejercicio === this.ejercicio() && f.periodo303.trimestre === this.trimestreSel())
      .sort((a, b) => b.numeroRecepcion - a.numeroRecepcion),
  );

  protected readonly resumen = computed(() =>
    resumen303(this.service.facturas(), { ejercicio: this.ejercicio(), trimestre: this.trimestreSel() }),
  );

  ngOnInit(): void {
    const periodo = trimestre(this.fechaHoy());
    this.ejercicio.set(periodo.ejercicio);
    this.trimestreSel.set(periodo.trimestre);
    void this.service.cargar(periodo.ejercicio);
  }

  ngOnDestroy(): void {
    if (this.escuchandoMovimientos) this.gestoria.stopTodosMovimientos();
  }

  protected onEjercicio(valor: string): void {
    const ejercicio = Number(valor);
    if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) return;
    this.ejercicio.set(ejercicio);
    void this.service.cargar(ejercicio);
  }

  protected onTrimestre(valor: string): void {
    this.trimestreSel.set(Number(valor) as TrimestreIva);
  }

  protected ivaDe(f: FacturaRecibida): number {
    return f.lineasIva.reduce((s, l) => s + l.cuota, 0);
  }

  protected puedeAnular(f: FacturaRecibida): boolean {
    return f.estado === 'registrada';
  }

  protected puedeValidar(f: FacturaRecibida): boolean {
    return puedeValidarQr(f);
  }

  protected validando(f: FacturaRecibida): boolean {
    return this.validandoIds().has(f.id);
  }

  /** Estado del QR para la lista: un error local (HttpsError) pisa al persistido; `null` si no hay QR. */
  protected vistaQr(f: FacturaRecibida): VistaQrValidacion | null {
    const local = this.erroresQr()[f.id];
    if (local) return vistaQrValidacion({ estado: 'error', mensaje: local, urlConsulta: f.qrValidacion.urlConsulta });
    return vistaQrValidacion(f.qrValidacion);
  }

  protected colorQr(tono: TonoQr): string {
    return tono === 'success'
      ? 'var(--success)'
      : tono === 'warning'
        ? 'var(--warning)'
        : tono === 'danger'
          ? 'var(--danger)'
          : 'var(--text-muted)';
  }

  protected acciones(f: FacturaRecibida): MenuAction[] {
    const menu: MenuAction[] = [];
    if (puedeValidarQr(f)) {
      menu.push({ id: 'validar-qr', label: 'Validar en AEAT', icon: ShieldCheck, disabled: this.validando(f) });
    }
    if (this.puedeAnular(f)) menu.push({ id: 'anular', label: 'Anular factura', icon: Ban, danger: true });
    return menu;
  }

  protected ejecutarAccion(f: FacturaRecibida, id: string): void {
    if (id === 'anular') void this.anular(f);
    else if (id === 'validar-qr') void this.validarQr(f);
  }

  /**
   * Consulta el QR en la AEAT vía callable. Nunca lanza: el resultado (o el error amistoso) queda en el estado de
   * la fila y en la región `aria-live`; jamás bloquea ni estropea un registro.
   */
  protected async validarQr(f: FacturaRecibida): Promise<void> {
    if (this.validando(f)) return;
    this.validandoIds.update((s) => new Set(s).add(f.id));
    this.erroresQr.update(({ [f.id]: _, ...resto }) => resto);
    let recargar = false;
    try {
      const r = await this.service.validarQr(f.id);
      this.anuncio.set(anuncioValidacionQr(f.numero, r) ?? '');
      recargar = true;
    } catch (err) {
      const mensaje = mensajeErrorValidarQr(err);
      this.erroresQr.update((e) => ({ ...e, [f.id]: mensaje }));
      this.anuncio.set(`${f.numero}: ${mensaje}`);
    } finally {
      this.validandoIds.update((s) => {
        const n = new Set(s);
        n.delete(f.id);
        return n;
      });
    }
    // El servidor ya persistió `qrValidacion`: refrescamos la lista (un fallo aquí no es un fallo de validación).
    if (recargar) await this.service.cargar(this.ejercicio()).catch(() => undefined);
  }

  protected abrirDrawer(): void {
    this.errorServidor.set(null);
    this.reactivacionPendiente.set(false);
    if (!this.escuchandoMovimientos) {
      this.escuchandoMovimientos = true;
      this.gestoria.loadTodosMovimientos();
    }
    this.drawerAbierto.set(true);
  }

  protected cerrarDrawer(): void {
    this.drawerAbierto.set(false);
  }

  protected async anular(f: FacturaRecibida): Promise<void> {
    try {
      await this.service.anular(f.id);
      this.toast.success(`Factura ${f.numero} anulada`);
      await this.service.cargar(this.ejercicio());
    } catch (err) {
      this.toast.fromError(err, { title: 'No se pudo anular la factura' });
    }
  }

  protected async exportarLibro(): Promise<void> {
    if (this.exportando() || this.resumen().numFacturas === 0) return;
    const empresa = this.company.activeCompany();
    const nif = empresa?.cif?.trim();
    if (!empresa || !nif) {
      this.toast.info('Indica el NIF o CIF de tu empresa en su perfil para poder exportar el libro de facturas recibidas.');
      return;
    }
    this.exportando.set(true);
    try {
      await this.libro.exportar(
        this.service.facturas(),
        { ejercicio: this.ejercicio(), trimestre: this.trimestreSel() },
        { nif, nombre: empresa.name },
      );
    } catch (err) {
      this.toast.fromError(err, { title: 'No se pudo exportar el libro' });
    } finally {
      this.exportando.set(false);
    }
  }

  protected async registrar({ datos, reactivar, archivo, movimiento }: FacturaRecibidaPayload): Promise<void> {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.errorServidor.set(null);
    this.reactivacionPendiente.set(false);
    try {
      const r = await this.service.registrar(datos, { reactivar, archivo, movimiento });
      this.toast.success(
        r.reactivada ? 'Factura reactivada' : `Factura registrada con el número de recepción ${r.numeroRecepcion}`,
      );
      this.drawerAbierto.set(false);
      await this.service.cargar(this.ejercicio());
      // Fire-and-forget: la validación del QR nunca retrasa ni hace fallar el registro.
      const nueva = this.service.facturas().find((x) => x.id === r.id);
      if (nueva && nueva.qrValidacion.estado === 'pendiente' && puedeValidarQr(nueva)) void this.validarQr(nueva);
    } catch (err) {
      if (err instanceof FacturaDuplicadaError || err instanceof MovimientoYaVinculadoError || err instanceof MovimientoNoEncontradoError) {
        this.errorServidor.set(err.message);
      }
      else if (err instanceof FacturaAnuladaExistenteError) this.reactivacionPendiente.set(true);
      else this.toast.fromError(err, { title: 'No se pudo registrar la factura' });
    } finally {
      this.guardando.set(false);
    }
  }
}
