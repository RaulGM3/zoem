import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import type {
  CuentaBancaria, GestoriaSlot, MovimientoGestoria, ResumenFinanciero,
} from '../../../../interfaces';
import { CasoCostosPrevistosComponent } from '../caso-costos-previstos/caso-costos-previstos';
import { CasoResumenFinancieroComponent } from '../caso-resumen-financiero/caso-resumen-financiero';
import { CasoMovimientosComponent } from '../caso-movimientos/caso-movimientos';

/**
 * Pestaña de gestoría de un caso. Solo compone sus tres bloques: costos
 * previstos, resumen financiero y tabla de movimientos.
 */
@Component({
  selector: 'app-caso-gestoria-tab',
  host: { style: 'display: block' },
  imports: [CasoCostosPrevistosComponent, CasoResumenFinancieroComponent, CasoMovimientosComponent],
  templateUrl: './caso-gestoria-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoGestoriaTabComponent {
  readonly slots = input.required<GestoriaSlot[]>();
  readonly movimientos = input.required<MovimientoGestoria[]>();
  readonly movimientosLoading = input.required<boolean>();
  readonly resumen = input.required<ResumenFinanciero>();
  readonly miembros = input<ReadonlyMap<string, string>>(new Map());
  readonly cuentas = input<CuentaBancaria[]>([]);
  /** Gating de permisos (mirroring de `Casos.editar`/`Casos.eliminar`); oculta acciones si no aplica. */
  readonly canEdit = input(true);
  readonly canDelete = input(true);

  readonly registerSlot = output<GestoriaSlot>();
  readonly unregisterSlot = output<GestoriaSlot>();
  readonly addMov = output<void>();
  readonly deleteMov = output<string>();
  readonly editMov = output<MovimientoGestoria>();
  readonly reorderSlots = output<GestoriaSlot[]>();
}
