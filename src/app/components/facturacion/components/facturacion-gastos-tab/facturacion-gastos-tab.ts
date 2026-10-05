import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { LucideAngularModule, Ban, Plus, Info } from 'lucide-angular';
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
} from '../../../../core/services/facturas-recibidas.service';
import { ToastService } from '../../../../core/services/toast.service';
import { resumen303 } from '../../../../core/facturas-recibidas/resumen303';
import { trimestre } from '../../../../core/facturas-recibidas/trimestre';
import type { FacturaRecibida, TrimestreIva } from '../../../../interfaces/factura-recibida.interface';
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
export class FacturacionGastosTabComponent implements OnInit {
  private readonly service = inject(FacturasRecibidasService);
  private readonly toast = inject(ToastService);

  /** Fecha de hoy (`yyyy-MM-dd`): fija el periodo inicial y la fecha de registro propuesta. */
  readonly fechaHoy = input.required<string>();

  protected readonly BanIcon = Ban;
  protected readonly PlusIcon = Plus;
  protected readonly InfoIcon = Info;
  protected readonly fechaCorta = fechaCorta;
  protected readonly trimestres: readonly TrimestreIva[] = [1, 2, 3, 4];

  protected readonly ejercicio = signal(0);
  protected readonly trimestreSel = signal<TrimestreIva>(1);
  protected readonly cargando = this.service.cargando;

  protected readonly drawerAbierto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly reactivacionPendiente = signal(false);

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

  protected acciones(f: FacturaRecibida): MenuAction[] {
    return this.puedeAnular(f) ? [{ id: 'anular', label: 'Anular factura', icon: Ban, danger: true }] : [];
  }

  protected ejecutarAccion(f: FacturaRecibida, id: string): void {
    if (id === 'anular') void this.anular(f);
  }

  protected abrirDrawer(): void {
    this.errorServidor.set(null);
    this.reactivacionPendiente.set(false);
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

  protected async registrar({ datos, reactivar }: FacturaRecibidaPayload): Promise<void> {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.errorServidor.set(null);
    this.reactivacionPendiente.set(false);
    try {
      const r = await this.service.registrar(datos, { reactivar });
      this.toast.success(
        r.reactivada ? 'Factura reactivada' : `Factura registrada con el número de recepción ${r.numeroRecepcion}`,
      );
      this.drawerAbierto.set(false);
      await this.service.cargar(this.ejercicio());
    } catch (err) {
      if (err instanceof FacturaDuplicadaError) this.errorServidor.set(err.message);
      else if (err instanceof FacturaAnuladaExistenteError) this.reactivacionPendiente.set(true);
      else this.toast.fromError(err, { title: 'No se pudo registrar la factura' });
    } finally {
      this.guardando.set(false);
    }
  }
}
