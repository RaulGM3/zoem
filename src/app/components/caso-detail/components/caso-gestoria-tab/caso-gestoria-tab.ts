import {
  Component, ChangeDetectionStrategy, input, output, computed, signal, linkedSignal,
} from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import {
  LucideAngularModule, Plus, Trash2, X, CheckCircle2, CircleAlert, GripVertical,
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
  readonly reorderSlots = output<GestoriaSlot[]>();

  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly CircleAlertIcon = CircleAlert;
  readonly GripVerticalIcon = GripVertical;

  /** Copia local reordenable; se resincroniza cuando cambia el input. */
  readonly orderedSlots = linkedSignal<GestoriaSlot[]>(() => this.slots());

  readonly dragFrom = signal<number | null>(null);
  readonly dragOver = signal<number | null>(null);

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
