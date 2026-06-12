import {
  Component, OnInit, signal, computed,
  ChangeDetectionStrategy, inject, viewChild,
} from '@angular/core';
import { CasosService } from '../../core/services/casos.service';
import { EventosService } from '../../core/services/eventos.service';
import type { Evento, Hito, HitoEstado } from '../../interfaces';
import type { CalendarItem, EventGroup, ViewMode, WeekDay } from './calendario.types';
import { CalendarNavComponent } from './components/calendar-nav/calendar-nav';
import { DayScheduleComponent, type ItemTimeChange } from './components/day-schedule/day-schedule';

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const DAY_NAMES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const STATUS_MAP: Record<HitoEstado, CalendarItem['status']> = {
  pendiente: 'pendiente',
  en_progreso: 'pendiente',
  completado: 'confirmada',
  cancelado: 'cancelada',
};

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
  selector: 'app-calendario',
  imports: [CalendarNavComponent, DayScheduleComponent],
  templateUrl: './calendario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarioComponent implements OnInit {
  private readonly casosService = inject(CasosService);
  private readonly eventosService = inject(EventosService);
  private readonly nav = viewChild(CalendarNavComponent);

  readonly dayNames = DAY_NAMES;
  readonly today = localDateStr(new Date());

  allItems = signal<CalendarItem[]>([]);
  currentWeekStart = signal<string>(mondayOf(new Date()));
  selectedDates = signal<Set<string>>(new Set([localDateStr(new Date())]));
  viewMode = signal<ViewMode>('week');
  stripDayCount = signal(21);
  visibleMonthDate = signal<string>(mondayOf(new Date()));

  weekDays = computed<WeekDay[]>(() => {
    const start = new Date(this.currentWeekStart() + 'T00:00:00');
    const items = this.allItems();
    const selected = this.selectedDates();
    return Array.from({ length: this.stripDayCount() }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const date = localDateStr(d);
      return {
        date,
        dayName: DAY_NAMES[i % 7],
        dayNum: d.getDate(),
        hasEvents: items.some(e => e.date === date),
        isToday: date === this.today,
        isSelected: selected.has(date),
      };
    });
  });

  monthDays = computed<WeekDay[]>(() => {
    const anchor = new Date(this.currentWeekStart() + 'T00:00:00');
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const dow = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() + (dow === 0 ? -6 : 1 - dow));

    const items = this.allItems();
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
        hasEvents: items.some(e => e.date === date),
        isToday: date === this.today,
        isSelected: selected.has(date),
        isCurrentMonth: d.getMonth() === currentMonth,
      };
    });
  });

  weekMonthLabel = computed<string>(() => {
    const anchor = this.viewMode() === 'week' ? this.visibleMonthDate() : this.currentWeekStart();
    const d = new Date(anchor + 'T00:00:00');
    const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  groupedEvents = computed<EventGroup[]>(() => {
    const selected = this.selectedDates();
    if (selected.size === 0) return [];
    const filtered = this.allItems().filter(e => selected.has(e.date));
    const grouped = new Map<string, CalendarItem[]>();
    for (const e of filtered) {
      const list = grouped.get(e.date) ?? [];
      list.push(e);
      grouped.set(e.date, list);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items, label: this.formatDateLabel(date) }));
  });

  async ngOnInit(): Promise<void> {
    const [hitos] = await Promise.all([
      this.casosService.getHitosParaCalendario(),
      this.eventosService.loadEventos(),
    ]);

    const hitoItems = hitos
      .filter(h => h.estado !== 'cancelado' && h.fechaEstimada)
      .map(h => this.hitoToItem(h));

    const eventoItems = this.eventosService.eventos()
      .map(e => this.eventoToItem(e));

    this.allItems.set([...hitoItems, ...eventoItems]);
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

  async updateHitoEstado(event: { id: string; casoId: string; estado: HitoEstado }): Promise<void> {
    await this.casosService.updateHito(event.casoId, event.id, { estado: event.estado });
    this.allItems.update(items =>
      items.map(item =>
        item.id === event.id
          ? { ...item, hitoEstado: event.estado, status: STATUS_MAP[event.estado] }
          : item
      )
    );
  }

  async updateItemTime(event: ItemTimeChange): Promise<void> {
    if (event.horaInicio === null) {
      // Desagendar
      this.allItems.update(items =>
        items.map(i => i.id === event.id ? { ...i, horaInicio: undefined, duracionMinutos: undefined } : i)
      );
      if (event.itemType === 'hito') {
        await this.casosService.clearHitoSchedule(event.id);
      } else {
        await this.eventosService.clearEventoTime(event.id);
      }
    } else {
      // Programar / actualizar (con posible cambio de día)
      this.allItems.update(items =>
        items.map(i =>
          i.id === event.id
            ? {
                ...i,
                horaInicio: event.horaInicio!,
                duracionMinutos: event.duracionMinutos!,
                ...(event.date ? { date: event.date } : {}),
              }
            : i
        )
      );
      if (event.itemType === 'hito') {
        await this.casosService.updateHito(event.casoId ?? '', event.id, {
          horaAgenda: event.horaInicio!,
          duracionAgenda: event.duracionMinutos!,
          ...(event.date ? { fechaEstimada: event.date } : {}),
        });
      } else {
        const endMins = timeToMinutes(event.horaInicio!) + event.duracionMinutos!;
        await this.eventosService.updateEvento(event.id, {
          horaInicio: event.horaInicio!,
          horaFin: minutesToTime(endMins),
          todoDia: false,
          ...(event.date ? { fecha: event.date } : {}),
        });
      }
    }
  }

  private eventoToItem(e: Evento): CalendarItem {
    return {
      id: e.id,
      title: e.titulo,
      client: e.todoDia || !e.horaInicio ? 'Todo el día' : e.horaInicio,
      type: 'reunion',
      date: e.fecha,
      status: 'confirmada',
      ...(e.descripcion ? { description: e.descripcion } : {}),
      ...(!e.todoDia && e.horaInicio ? { horaInicio: e.horaInicio } : {}),
      ...(!e.todoDia && e.horaInicio && e.horaFin
        ? { duracionMinutos: timeToMinutes(e.horaFin) - timeToMinutes(e.horaInicio) }
        : {}),
    };
  }

  private hitoToItem(h: Hito): CalendarItem {
    return {
      id: h.id,
      title: h.titulo,
      client: h.casoTitulo,
      type: 'entrega',
      date: h.fechaEstimada!,
      status: STATUS_MAP[h.estado],
      hitoEstado: h.estado,
      casoId: h.casoId,
      ...(h.descripcion ? { description: h.descripcion } : {}),
      ...(h.horaAgenda ? { horaInicio: h.horaAgenda } : {}),
      ...(h.duracionAgenda ? { duracionMinutos: h.duracionAgenda } : {}),
    };
  }

  private formatDateLabel(dateStr: string): string {
    if (dateStr === this.today) return 'Hoy';
    const d = new Date(dateStr + 'T00:00:00');
    const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
