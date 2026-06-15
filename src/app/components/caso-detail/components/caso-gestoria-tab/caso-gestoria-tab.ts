import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import {
  LucideAngularModule, Plus, Trash2, X, CheckCircle2, CircleAlert,
} from 'lucide-angular';
import type {
  GestoriaSlot, MovimientoGestoria, MovimientoTipo, ResumenFinanciero,
} from '../../../../interfaces';

@Component({
  selector: 'app-caso-gestoria-tab',
  host: { style: 'display: block' },
  imports: [LucideAngularModule, DecimalPipe, TitleCasePipe],
  templateUrl: './caso-gestoria-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoGestoriaTabComponent {
  readonly slots = input.required<GestoriaSlot[]>();
  readonly movimientos = input.required<MovimientoGestoria[]>();
  readonly movimientosLoading = input.required<boolean>();
  readonly resumen = input.required<ResumenFinanciero>();

  readonly registerSlot = output<GestoriaSlot>();
  readonly unregisterSlot = output<GestoriaSlot>();
  readonly addMov = output<void>();
  readonly deleteMov = output<string>();

  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly CircleAlertIcon = CircleAlert;

  readonly slotsProgress = computed(() => {
    const slots = this.slots();
    if (slots.length === 0) return null;
    const registrados = slots.filter(s => s.status === 'registrado').length;
    return { registrados, total: slots.length };
  });

  getMovTipoClass(tipo: MovimientoTipo): string {
    const map: Record<MovimientoTipo, string> = {
      ingreso: 'bg-emerald-100 text-emerald-700',
      suplido: 'bg-amber-100 text-amber-700',
      honorario: 'bg-violet-100 text-violet-700',
      gasto: 'bg-red-100 text-red-700',
      otro: 'bg-slate-100 text-slate-600',
    };
    return map[tipo];
  }
}
