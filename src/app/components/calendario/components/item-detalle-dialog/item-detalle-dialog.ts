import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { LucideAngularModule, X, Trash2, Plus } from 'lucide-angular';
import { FocusTrapDirective } from '../../../../shared/directives/focus-trap.directive';
import { HorasEditorComponent, RegistrosChange } from '../horas-editor/horas-editor';
import type { CalendarItem, ItemColor } from '../../calendario.types';
import type { CompanyMember, EventoEstado, HitoEstado } from '../../../../interfaces';
import { HITO_ESTADOS, HITO_ESTADO_LABEL, HITO_ESTADO_BADGE_CLASS } from '../../../../core/hitos/hito-estado';
import { EVENTO_ESTADOS, EVENTO_ESTADO_LABEL, EVENTO_ESTADO_BADGE_CLASS } from '../../../../interfaces';
import { effectiveColor, itemTimeLabel } from '../../agenda-utils';

const COLOR_DOT: Record<ItemColor, string> = {
  violet: 'bg-violet-500',
  indigo: 'bg-indigo-500',
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  amber:  'bg-amber-500',
  red:    'bg-red-500',
  pink:   'bg-pink-500',
  slate:  'bg-slate-400',
};

const COLOR_SWATCH: Record<ItemColor, string> = {
  violet: 'bg-violet-500 ring-violet-500',
  indigo: 'bg-indigo-500 ring-indigo-500',
  blue:   'bg-blue-500 ring-blue-500',
  green:  'bg-green-500 ring-green-500',
  amber:  'bg-amber-500 ring-amber-500',
  red:    'bg-red-500 ring-red-500',
  pink:   'bg-pink-500 ring-pink-500',
  slate:  'bg-slate-400 ring-slate-400',
};

const ALL_COLORS: readonly ItemColor[] = ['violet', 'indigo', 'blue', 'green', 'amber', 'red', 'pink', 'slate'];

/**
 * Modal de detalle de un item de la agenda (hito o evento): estado, horas
 * trabajadas, anotaciones, color y borrado. Es presentacional: el padre decide
 * cuándo existe (montándolo con el item seleccionado) y persiste los cambios.
 */
@Component({
  selector: 'app-item-detalle-dialog',
  imports: [LucideAngularModule, FocusTrapDirective, HorasEditorComponent],
  templateUrl: './item-detalle-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetalleDialogComponent {
  readonly item = input.required<CalendarItem>();
  readonly members = input<CompanyMember[]>([]);

  readonly closed = output<void>();
  readonly hitoStatusChanged = output<{ id: string; casoId: string; estado: HitoEstado }>();
  readonly eventoStatusChanged = output<{ id: string; estado: EventoEstado }>();
  readonly annotationAdded = output<{ itemId: string; casoId?: string; texto: string }>();
  readonly annotationDeleted = output<{ itemId: string; casoId?: string; anotacionId: string }>();
  readonly itemColorChanged = output<{ id: string; color: ItemColor | null }>();
  readonly registrosChanged = output<RegistrosChange>();
  readonly eventoDeleted = output<{ id: string }>();

  readonly XIcon = X;
  readonly Trash2Icon = Trash2;
  readonly PlusIcon = Plus;

  readonly HITO_ESTADOS = HITO_ESTADOS;
  readonly EVENTO_ESTADOS = EVENTO_ESTADOS;
  readonly ALL_COLORS = ALL_COLORS;

  readonly newAnnotationText = signal('');
  readonly confirmingDelete = signal(false);

  close(): void {
    this.closed.emit();
  }

  requestDeleteEvento(): void {
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  confirmDeleteEvento(): void {
    this.eventoDeleted.emit({ id: this.item().id });
    this.close();
  }

  getTimeLabel(item: CalendarItem): string {
    return itemTimeLabel(item);
  }

  getItemTypeLabel(item: CalendarItem): string {
    if (item.hitoEstado !== undefined) return 'Hito';
    const labels: Record<string, string> = {
      reunion: 'Reunión', llamada: 'Llamada', entrega: 'Entrega', recordatorio: 'Recordatorio',
    };
    return labels[item.type] ?? item.type;
  }

  getHitoEstadoFullLabel(estado: HitoEstado): string {
    return HITO_ESTADO_LABEL[estado];
  }

  getEventoEstadoLabel(estado: EventoEstado): string {
    return EVENTO_ESTADO_LABEL[estado];
  }

  getHitoEstadoBtnClass(estado: HitoEstado, isActive: boolean): string {
    if (!isActive) return '';
    return `${HITO_ESTADO_BADGE_CLASS[estado]} ring-2 ring-offset-1 ring-current/30`;
  }

  getEventoEstadoBtnClass(estado: EventoEstado, isActive: boolean): string {
    if (!isActive) return '';
    return `${EVENTO_ESTADO_BADGE_CLASS[estado]} ring-2 ring-offset-1 ring-current/30`;
  }

  getModalHeaderColor(item: CalendarItem): string {
    return COLOR_DOT[effectiveColor(item)];
  }

  getColorSwatchClass(color: ItemColor, isActive: boolean): string {
    return `${COLOR_SWATCH[color]}${isActive ? ' ring-2 ring-offset-2 scale-110' : ''}`;
  }

  setItemColor(color: ItemColor | null): void {
    this.itemColorChanged.emit({ id: this.item().id, color });
  }

  setHitoEstado(estado: HitoEstado): void {
    const item = this.item();
    if (!item.casoId) return;
    this.hitoStatusChanged.emit({ id: item.id, casoId: item.casoId, estado });
  }

  setEventoEstado(estado: EventoEstado): void {
    this.eventoStatusChanged.emit({ id: this.item().id, estado });
  }

  addAnnotation(): void {
    const texto = this.newAnnotationText().trim();
    if (!texto) return;
    const item = this.item();
    this.annotationAdded.emit({ itemId: item.id, casoId: item.casoId, texto });
    this.newAnnotationText.set('');
  }

  deleteAnnotation(anotacionId: string): void {
    const item = this.item();
    this.annotationDeleted.emit({ itemId: item.id, casoId: item.casoId, anotacionId });
  }

  onAnnotationInput(event: Event): void {
    this.newAnnotationText.set((event.target as HTMLInputElement).value);
  }

  onAnnotationKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.addAnnotation();
    }
  }

  formatAnnotationDate(isoString: string): string {
    const date = new Date(isoString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Hoy';
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }
}
