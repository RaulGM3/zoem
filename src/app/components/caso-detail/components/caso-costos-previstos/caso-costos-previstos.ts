import { Component, ChangeDetectionStrategy, input, output, computed, signal, linkedSignal } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import {
  LucideAngularModule, Plus, X, CheckCircle2, CircleAlert, GripVertical, Eye, EyeOff, Check,
} from 'lucide-angular';
import type { GestoriaSlot } from '../../../../interfaces';

/** Costos previstos por la plantilla del caso: lista reordenable con su registro como movimiento. */
@Component({
  selector: 'app-caso-costos-previstos',
  host: { class: 'block' },
  imports: [LucideAngularModule, DecimalPipe, TitleCasePipe],
  templateUrl: './caso-costos-previstos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoCostosPrevistosComponent {
  readonly slots = input.required<GestoriaSlot[]>();
  readonly canEdit = input(true);
  readonly canDelete = input(true);

  readonly registerSlot = output<GestoriaSlot>();
  readonly unregisterSlot = output<GestoriaSlot>();
  readonly reorderSlots = output<GestoriaSlot[]>();

  readonly PlusIcon = Plus;
  readonly XIcon = X;
  readonly CheckIcon = Check;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly CircleAlertIcon = CircleAlert;
  readonly GripVerticalIcon = GripVertical;
  readonly EyeIcon = Eye;
  readonly EyeOffIcon = EyeOff;

  readonly showRegistrados = signal(false);

  /** Slot cuyo movimiento registrado se está a punto de ELIMINAR (irreversible: hace deleteDoc). */
  readonly confirmingUnregisterId = signal<string | null>(null);

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

  requestUnregister(slotId: string): void {
    this.confirmingUnregisterId.set(slotId);
  }

  cancelUnregister(): void {
    this.confirmingUnregisterId.set(null);
  }

  confirmUnregister(slot: GestoriaSlot): void {
    this.unregisterSlot.emit(slot);
    this.confirmingUnregisterId.set(null);
  }
}
