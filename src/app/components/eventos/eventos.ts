import {
  Component, OnInit, signal, computed,
  ChangeDetectionStrategy, inject, viewChild,
} from '@angular/core';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { EventosService } from '../../core/services/eventos.service';
import { CalendarNavComponent } from '../calendario/components/calendar-nav/calendar-nav';
import { NuevoEventoDrawerComponent } from './components/nuevo-evento-drawer/nuevo-evento-drawer';
import type { CreateEventoData, Evento, EventoColor, EventoPrioridad } from '../../interfaces';
import { EVENTO_COLORS, PRIORIDAD_CONFIG, RECURRENCIA_LABELS } from '../../interfaces';
import type { WeekDay, ViewMode } from '../calendario/calendario.types';

const DAY_NAMES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mondayOf(d: Date): string {
  const copy = new Date(d);
  const dow = copy.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + diff);
  return localDateStr(copy);
}

@Component({
  selector: 'app-eventos',
  imports: [LucideAngularModule, CalendarNavComponent, NuevoEventoDrawerComponent],
  templateUrl: './eventos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventosComponent implements OnInit {
  private readonly eventosService = inject(EventosService);
  private readonly nav = viewChild(CalendarNavComponent);

  readonly PlusIcon = Plus;
  readonly dayNames = DAY_NAMES;
  readonly today = localDateStr(new Date());

  readonly eventos = this.eventosService.eventos;
  readonly loading = this.eventosService.loading;

  currentWeekStart = signal<string>(mondayOf(new Date()));
  selectedDates = signal<Set<string>>(new Set([localDateStr(new Date())]));
  viewMode = signal<ViewMode>('week');
  stripDayCount = signal(21);
  visibleMonthDate = signal<string>(mondayOf(new Date()));

  showDrawer = signal(false);
  saving = signal(false);
  editingEvento = signal<Evento | null>(null);

  readonly weekDays = computed<WeekDay[]>(() => {
    const start = new Date(this.currentWeekStart() + 'T00:00:00');
    const items = this.eventos();
    const selected = this.selectedDates();
    return Array.from({ length: this.stripDayCount() }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const date = localDateStr(d);
      return {
        date,
        dayName: DAY_NAMES[i % 7],
        dayNum: d.getDate(),
        hasEvents: items.some(e => e.fecha === date),
        isToday: date === this.today,
        isSelected: selected.has(date),
      };
    });
  });

  readonly monthDays = computed<WeekDay[]>(() => {
    const anchor = new Date(this.currentWeekStart() + 'T00:00:00');
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const dow = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() + (dow === 0 ? -6 : 1 - dow));

    const items = this.eventos();
    const selected = this.selectedDates();
    const currentMonth = anchor.getMonth();

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      const date = localDateStr(d);
      return {
        date,
        dayName: DAY_NAMES[i % 7],
        dayNum: d.getDate(),
        hasEvents: items.some(e => e.fecha === date),
        isToday: date === this.today,
        isSelected: selected.has(date),
        isCurrentMonth: d.getMonth() === currentMonth,
      };
    });
  });

  readonly weekMonthLabel = computed<string>(() => {
    const anchor = this.viewMode() === 'week' ? this.visibleMonthDate() : this.currentWeekStart();
    const d = new Date(anchor + 'T00:00:00');
    const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  readonly groupedEventos = computed(() => {
    const selected = this.selectedDates();
    if (selected.size === 0) return [];
    const filtered = this.eventos().filter(e => selected.has(e.fecha));
    const grouped = new Map<string, Evento[]>();
    for (const e of filtered) {
      const list = grouped.get(e.fecha) ?? [];
      list.push(e);
      grouped.set(e.fecha, list);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items, label: this.formatDateLabel(date) }));
  });

  async ngOnInit(): Promise<void> {
    await this.eventosService.loadEventos();
  }

  toggleDate(date: string): void {
    this.selectedDates.update(set => {
      const next = new Set(set);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  setViewMode(mode: ViewMode): void {
    if (mode === this.viewMode()) return;
    if (mode === 'week') {
      const monday = mondayOf(new Date(this.currentWeekStart() + 'T00:00:00'));
      this.currentWeekStart.set(monday);
      this.visibleMonthDate.set(monday);
      this.stripDayCount.set(21);
    }
    this.viewMode.set(mode);
  }

  prevWeek(): void {
    const d = new Date(this.currentWeekStart() + 'T00:00:00');
    if (this.viewMode() === 'month') {
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      this.currentWeekStart.set(localDateStr(d));
    } else {
      d.setDate(d.getDate() - 7);
      const newStart = localDateStr(d);
      this.currentWeekStart.set(newStart);
      this.visibleMonthDate.set(newStart);
      this.stripDayCount.set(21);
      this.nav()?.scrollToStart();
    }
  }

  nextWeek(): void {
    const d = new Date(this.currentWeekStart() + 'T00:00:00');
    if (this.viewMode() === 'month') {
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      this.currentWeekStart.set(localDateStr(d));
    } else {
      d.setDate(d.getDate() + 7);
      const newStart = localDateStr(d);
      this.currentWeekStart.set(newStart);
      this.visibleMonthDate.set(newStart);
      this.stripDayCount.set(21);
      this.nav()?.scrollToStart();
    }
  }

  async onSaveEvento(data: CreateEventoData): Promise<void> {
    this.saving.set(true);
    try {
      await this.eventosService.createEvento(data);
      this.showDrawer.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  async deleteEvento(id: string): Promise<void> {
    await this.eventosService.deleteEvento(id);
  }

  getColorConfig(color: EventoColor) {
    return EVENTO_COLORS[color];
  }

  getPrioridadConfig(p: EventoPrioridad) {
    return PRIORIDAD_CONFIG[p];
  }

  getRecurrenciaLabel(r: string): string {
    return RECURRENCIA_LABELS[r as keyof typeof RECURRENCIA_LABELS] ?? r;
  }

  formatTime(evento: Evento): string {
    if (evento.todoDia) return 'Todo el día';
    if (evento.horaInicio && evento.horaFin) return `${evento.horaInicio} – ${evento.horaFin}`;
    if (evento.horaInicio) return evento.horaInicio;
    return '';
  }

  formatInvitados(evento: Evento): string {
    if (evento.invitados === 'todos') return 'Toda la compañía';
    const count = evento.invitados.length;
    if (count === 0) return 'Sin invitados';
    return `${count} invitado${count > 1 ? 's' : ''}`;
  }

  private formatDateLabel(dateStr: string): string {
    if (dateStr === this.today) return 'Hoy';
    const d = new Date(dateStr + 'T00:00:00');
    const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
