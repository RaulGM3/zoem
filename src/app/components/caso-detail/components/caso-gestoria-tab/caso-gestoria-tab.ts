import {
  Component, ChangeDetectionStrategy, input, output, computed, signal, linkedSignal,
} from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import {
  LucideAngularModule, Plus, Trash2, X, CheckCircle2, CircleAlert, GripVertical, Eye, EyeOff,
} from 'lucide-angular';
import type {
  CuentaBancaria, GestoriaSlot, MovimientoGestoria, MovimientoTipo, ResumenFinanciero,
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
  readonly miembros = input<ReadonlyMap<string, string>>(new Map());
  readonly cuentas = input<CuentaBancaria[]>([]);

  readonly registerSlot = output<GestoriaSlot>();
  readonly unregisterSlot = output<GestoriaSlot>();
  readonly addMov = output<void>();
  readonly deleteMov = output<string>();
  readonly reorderSlots = output<GestoriaSlot[]>();

  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly CircleAlertIcon = CircleAlert;
  readonly GripVerticalIcon = GripVertical;
  readonly EyeIcon = Eye;
  readonly EyeOffIcon = EyeOff;

  readonly showRegistrados = signal(false);

  readonly cuentaMap = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.cuentas()) map.set(c.id, c.nombre);
    return map;
  });

  /** Copia local reordenable; se resincroniza cuando cambia el input. */
  readonly orderedSlots = linkedSignal<GestoriaSlot[]>(() => this.slots());

  readonly dragFrom = signal<number | null>(null);
  readonly dragOver = signal<number | null>(null);

  readonly resumenMov = computed(() => {
    const acc = {
      totalIngresos: 0, totalEgresos: 0, suplidos: 0, honorarios: 0, gastos: 0, otros: 0,
      saldo: 0, ivaRepercutido: 0, ivaSoportado: 0,
    };
    for (const m of this.movimientos()) {
      const cuota = m.cuotaIva ?? 0;
      if (m.esEntrada) {
        acc.totalIngresos += m.importe;
        acc.ivaRepercutido += cuota;
      } else {
        acc.totalEgresos += m.importe;
        acc.ivaSoportado += cuota;
        if (m.tipo === 'suplido') acc.suplidos += m.importe;
        else if (m.tipo === 'honorario') acc.honorarios += m.importe;
        else if (m.tipo === 'gasto') acc.gastos += m.importe;
        else acc.otros += m.importe;
      }
    }
    acc.saldo = acc.totalIngresos - acc.totalEgresos;
    return acc;
  });

  readonly slotsProgress = computed(() => {
    const slots = this.slots();
    if (slots.length === 0) return null;
    const registrados = slots.filter(s => s.status === 'registrado').length;
    return { registrados, total: slots.length };
  });

  onSlotDragStart(event: DragEvent, index: number): void {
    this.dragFrom.set(index);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onSlotDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOver.set(index);
  }

  onSlotDrop(event: DragEvent): void {
    event.preventDefault();
    const from = this.dragFrom();
    const to = this.dragOver();
    this.dragFrom.set(null);
    this.dragOver.set(null);
    if (from === null || to === null || from === to) return;
    const list = [...this.orderedSlots()];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    this.orderedSlots.set(list);
    this.reorderSlots.emit(list);
  }

  onSlotDragEnd(): void {
    this.dragFrom.set(null);
    this.dragOver.set(null);
  }

  getMovTipoStyle(tipo: MovimientoTipo): { background: string; color: string } {
    const mix = (v: string) => `color-mix(in srgb,${v} 12%,transparent)`;
    const map: Record<MovimientoTipo, { background: string; color: string }> = {
      ingreso:   { background: mix('var(--success)'), color: 'var(--success)' },
      suplido:   { background: mix('var(--warning)'), color: 'var(--warning)' },
      honorario: { background: mix('var(--accent-ia)'), color: 'var(--accent-ia)' },
      gasto:     { background: mix('var(--danger)'),  color: 'var(--danger)' },
      otro:      { background: 'var(--surface-2)',     color: 'var(--text-muted)' },
    };
    return map[tipo];
  }
}
