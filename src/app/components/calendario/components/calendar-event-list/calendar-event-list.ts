import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import {
  LucideAngularModule, LucideIconData,
  Calendar, Phone, Users, FileText, Bell,
} from 'lucide-angular';
import type { CalendarItem, EventGroup } from '../../calendario.types';
import type { HitoEstado } from '../../../../interfaces';
import {
  HITO_ESTADO_LABEL,
  HITO_ESTADO_BADGE_CLASS,
  HITO_OVERDUE_LABEL,
  HITO_OVERDUE_BADGE_CLASS,
  nextHitoEstado,
  prevHitoEstado,
  isHitoOverdue,
} from '../../../../core/hitos/hito-estado';

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  selector: 'app-calendar-event-list',
  imports: [LucideAngularModule],
  templateUrl: './calendar-event-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarEventListComponent {
  readonly groupedEvents = input.required<EventGroup[]>();
  readonly hasSelectedDates = input.required<boolean>();
  readonly hitoStatusChanged = output<{ id: string; casoId: string; estado: HitoEstado }>();

  readonly CalendarIcon = Calendar;

  private readonly today = todayStr();

  isOverdue(event: CalendarItem): boolean {
    return isHitoOverdue(event.hitoEstado, event.date, this.today);
  }

  getHitoEstadoLabel(event: CalendarItem): string {
    if (this.isOverdue(event)) return HITO_OVERDUE_LABEL;
    return HITO_ESTADO_LABEL[event.hitoEstado!] ?? event.hitoEstado!;
  }

  getHitoEstadoClass(event: CalendarItem): string {
    if (this.isOverdue(event)) return HITO_OVERDUE_BADGE_CLASS;
    return HITO_ESTADO_BADGE_CLASS[event.hitoEstado!] ?? 'bg-slate-100 text-slate-600';
  }

  advanceHito(event: CalendarItem): void {
    if (!event.casoId || !event.hitoEstado || event.hitoEstado === 'completado') return;
    this.hitoStatusChanged.emit({ id: event.id, casoId: event.casoId, estado: nextHitoEstado(event.hitoEstado) });
  }

  revertHito(event: CalendarItem): void {
    if (!event.casoId || !event.hitoEstado || event.hitoEstado === 'pendiente') return;
    this.hitoStatusChanged.emit({ id: event.id, casoId: event.casoId, estado: prevHitoEstado(event.hitoEstado) });
  }

  getTypeIcon(type: string): LucideIconData {
    const map: Record<string, LucideIconData> = {
      reunion: Users,
      llamada: Phone,
      entrega: FileText,
      recordatorio: Bell,
    };
    return map[type] ?? Calendar;
  }

  getTypeClass(type: string): string {
    const map: Record<string, string> = {
      reunion: 'bg-violet-100 text-violet-700',
      llamada: 'bg-green-100 text-green-700',
      entrega: 'bg-blue-100 text-blue-700',
      recordatorio: 'bg-amber-100 text-amber-700',
    };
    return map[type] ?? 'bg-slate-100 text-slate-600';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      confirmada: 'bg-green-100 text-green-700',
      pendiente: 'bg-amber-100 text-amber-700',
      cancelada: 'bg-red-100 text-red-700',
    };
    return map[status] ?? 'bg-slate-100 text-slate-600';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      confirmada: 'Confirmado',
      pendiente: 'Pendiente',
      cancelada: 'Cancelado',
    };
    return map[status] ?? status;
  }
}
