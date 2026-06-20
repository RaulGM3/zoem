import {
  Component, ChangeDetectionStrategy, input, output, signal, effect, inject,
} from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import type { Caso, GestoriaSlot, ResumenFinanciero } from '../../../../interfaces';
import { RESUMEN_FINANCIERO_VACIO } from '../../../../interfaces';
import { CasoGestoriaTabComponent } from '../../../caso-detail/components/caso-gestoria-tab/caso-gestoria-tab';
import { MovimientoFormDrawerComponent, type MovimientoFormData } from '../../../caso-detail/components/movimiento-form-drawer/movimiento-form-drawer';
import { GestoriaService } from '../../../../core/services/gestoria.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CasosService } from '../../../../core/services/casos.service';
import { CuentasService } from '../../../../core/services/cuentas.service';

@Component({
  selector: 'app-tesoreria-caso-drawer',
  imports: [LucideAngularModule, CasoGestoriaTabComponent, MovimientoFormDrawerComponent],
  templateUrl: './tesoreria-caso-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TesoresriaCasoDrawerComponent {
  private readonly gestoriaService = inject(GestoriaService);
  private readonly casosService = inject(CasosService);
  private readonly toast = inject(ToastService);
  private readonly cuentasService = inject(CuentasService);

  readonly cuentas = this.cuentasService.cuentas;

  readonly caso = input.required<Caso | null>();
  readonly closed = output<void>();

  readonly XIcon = X;

  readonly showMovForm = signal(false);
  readonly savingMov = signal(false);
  readonly prefillSlot = signal<GestoriaSlot | null>(null);

  readonly slots = this.gestoriaService.slots;
  readonly movimientos = this.gestoriaService.movimientos;
  readonly movimientosLoading = this.gestoriaService.loading;

  readonly resumen = signal<ResumenFinanciero>(RESUMEN_FINANCIERO_VACIO);

  constructor() {
    effect(() => {
      const c = this.caso();
      if (c) {
        this.resumen.set(c.resumenFinanciero ?? RESUMEN_FINANCIERO_VACIO);
        this.gestoriaService.loadSlots(c.id);
        this.gestoriaService.loadMovimientos(c.id);
      } else {
        this.gestoriaService.stopMovimientos();
        this.gestoriaService.slots.set([]);
        this.gestoriaService.movimientos.set([]);
      }
    });
  }

  openMovForm(): void {
    this.prefillSlot.set(null);
    this.showMovForm.set(true);
  }

  async onRegisterSlot(slot: GestoriaSlot): Promise<void> {
    this.prefillSlot.set(slot);
    this.showMovForm.set(true);
  }

  private syncResumen(casoId: string): void {
    this.resumen.set(this.casosService.casos().find(x => x.id === casoId)?.resumenFinanciero ?? RESUMEN_FINANCIERO_VACIO);
  }

  async onUnregisterSlot(slot: GestoriaSlot): Promise<void> {
    const c = this.caso();
    if (!c) return;
    await this.toast.run(() => this.gestoriaService.unregisterSlot(c.id, slot), {
      successMessage: 'Slot desregistrado',
      errorTitle: 'No se pudo desregistrar el slot',
      onSuccess: () => this.syncResumen(c.id),
    });
  }

  async onSaveMov(data: MovimientoFormData): Promise<void> {
    const c = this.caso();
    if (!c) return;
    this.savingMov.set(true);
    try {
      const slot = this.prefillSlot();
      await this.toast.run(
        () => slot ? this.gestoriaService.registerSlot(c.id, slot, data) : this.gestoriaService.addMovimiento(c.id, data),
        {
          successMessage: 'Movimiento registrado',
          errorTitle: 'No se pudo registrar el movimiento',
          onSuccess: () => {
            this.syncResumen(c.id);
            this.showMovForm.set(false);
          },
        }
      );
    } finally {
      this.savingMov.set(false);
    }
  }

  async onDeleteMov(movId: string): Promise<void> {
    const c = this.caso();
    if (!c) return;
    await this.toast.run(() => this.gestoriaService.deleteMovimiento(c.id, movId), {
      successMessage: 'Movimiento eliminado',
      errorTitle: 'No se pudo eliminar el movimiento',
      onSuccess: () => this.syncResumen(c.id),
    });
  }

  onReorderSlots(orderedSlots: GestoriaSlot[]): void {
    const c = this.caso();
    if (!c) return;
    this.toast.run(() => this.gestoriaService.reorderSlots(c.id, orderedSlots), {
      errorTitle: 'No se pudo reordenar',
    });
  }
}
