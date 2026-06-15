import {
  Component, signal, computed,
  ChangeDetectionStrategy, inject, viewChild,
} from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, filter, map, switchMap } from 'rxjs';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { CasosService } from '../../core/services/casos.service';
import { CompanyService } from '../../core/services/company.service';
import { EventosService } from '../../core/services/eventos.service';
import { UserSyncService } from '../../core/services/user-sync.service';
import { HITO_ESTADO_CALENDAR_STATUS, stampEstadoChange } from '../../core/hitos/hito-estado';
import type { CreateEventoData, Evento, EventoColor, EventoEstado, Hito, HitoEstado } from '../../interfaces';
import type { CalendarItem, EventGroup, ViewMode, WeekDay } from './calendario.types';
import { CalendarNavComponent } from './components/calendar-nav/calendar-nav';
import { DayScheduleComponent, type ItemTimeChange } from './components/day-schedule/day-schedule';
import { NuevoEventoDrawerComponent } from '../eventos/components/nuevo-evento-drawer/nuevo-evento-drawer';
import type { ItemColor } from './calendario.types';

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Color intrínseco del evento (EventoColor) → paleta del calendario (ItemColor). */
const EVENTO_COLOR_TO_ITEM: Record<EventoColor, ItemColor> = {
  rojo: 'red',
  naranja: 'amber',
  amarillo: 'amber',
  verde: 'green',
  azul: 'blue',
  violeta: 'violet',
  gris: 'slate',
};

function mapEventoColor(color: EventoColor | undefined): ItemColor {
  return color ? EVENTO_COLOR_TO_ITEM[color] : 'slate';
}

/** Estado del evento → status genérico del CalendarItem. */
const EVENTO_ESTADO_TO_STATUS: Record<EventoEstado, CalendarItem['status']> = {
  confirmado: 'confirmada',
  completado: 'confirmada',
  tentativo: 'pendiente',
  en_progreso: 'pendiente',
  cancelado: 'cancelada',
};

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
  selector: 'app-calendario',
  imports: [CalendarNavComponent, DayScheduleComponent, NuevoEventoDrawerComponent, LucideAngularModule],
  templateUrl: './calendario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
})
export class CalendarioComponent {
  private readonly casosService = inject(CasosService);
  private readonly companyService = inject(CompanyService);
  private readonly eventosService = inject(EventosService);
  private readonly userSync = inject(UserSyncService);
  private readonly nav = viewChild(CalendarNavComponent);

  readonly PlusIcon = Plus;
  readonly dayNames = DAY_NAMES;
  readonly today = localDateStr(new Date());

  readonly showDrawer = signal(false);
  readonly saving = signal(false);

  /**
   * Read model único del calendario: stream real-time de Firestore (hitos +
   * eventos) combinado y mapeado a CalendarItem. Es la ÚNICA fuente de verdad —
   * las mutaciones solo escriben en Firestore y el stream refleja el cambio.
   * No hay actualizaciones optimistas manuales que mantener en sync.
   */
  readonly allItems = toSignal(
    toObservable(this.companyService.activeCompany).pipe(
      // Espera a que haya empresa activa; re-suscribe si el usuario cambia de empresa.
      filter(company => company !== null),
      switchMap(() =>
        combineLatest([
          this.casosService.hitosParaCalendarioStream(),
          this.eventosService.eventosStream(),
        ]),
      ),
      map(([hitos, eventos]) => [
        ...hitos
          .filter(h => h.estado !== 'cancelado' && h.fechaEstimada)
          .map(h => this.hitoToItem(h)),
        ...eventos.map(e => this.eventoToItem(e)),
      ]),
    ),
    { initialValue: [] as CalendarItem[] },
  );

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
    const grouped = new Map<string, CalendarItem[]>();
    for (const date of selected) grouped.set(date, []);
    for (const e of this.allItems()) {
      if (selected.has(e.date)) grouped.get(e.date)!.push(e);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items, label: this.formatDateLabel(date) }));
  });

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
    // Solo persiste: el stream real-time refleja el cambio en el read model.
    await this.casosService.updateHito(event.casoId, event.id, {
      estado: event.estado,
      ...stampEstadoChange(this.userSync.currentUser()?.id),
    });
  }

  async updateEventoEstado(event: { id: string; estado: EventoEstado }): Promise<void> {
    await this.eventosService.updateEvento(event.id, { estado: event.estado });
  }

  async updateItemTime(event: ItemTimeChange): Promise<void> {
    if (event.horaInicio === null) {
      // Desagendar
      if (event.itemType === 'hito') {
        await this.casosService.clearHitoSchedule(event.id);
      } else {
        await this.eventosService.clearEventoTime(event.id);
      }
    } else {
      // Programar / actualizar (con posible cambio de día)
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

  async onSaveEvento(data: CreateEventoData): Promise<void> {
    this.saving.set(true);
    try {
      await this.eventosService.createEvento(data);
      this.showDrawer.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  async updateItemColor({ id, color }: { id: string; color: ItemColor | null }): Promise<void> {
    const item = this.allItems().find(i => i.id === id);
    if (!item) return;
    if (item.hitoEstado !== undefined && item.casoId) {
      await this.casosService.updateHito(item.casoId, id, { calendarColor: color });
    } else {
      await this.eventosService.updateEvento(id, { calendarColor: color });
    }
  }

  private eventoToItem(e: Evento): CalendarItem {
    const estado: EventoEstado = e.estado ?? 'confirmado';
    // El color del evento elegido al crearlo (EventoColor) es la base; el
    // calendarColor — override específico del calendario — gana si existe.
    const color = (e.calendarColor as ItemColor | undefined) ?? mapEventoColor(e.color);
    return {
      id: e.id,
      title: e.titulo,
      client: e.todoDia || !e.horaInicio ? 'Todo el día' : e.horaInicio,
      type: 'reunion',
      date: e.fecha,
      status: EVENTO_ESTADO_TO_STATUS[estado],
      eventoEstado: estado,
      color,
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
      status: HITO_ESTADO_CALENDAR_STATUS[h.estado],
      hitoEstado: h.estado,
      casoId: h.casoId,
      ...(h.descripcion ? { description: h.descripcion } : {}),
      ...(h.horaAgenda ? { horaInicio: h.horaAgenda } : {}),
      ...(h.duracionAgenda ? { duracionMinutos: h.duracionAgenda } : {}),
      ...(h.calendarColor ? { color: h.calendarColor as ItemColor } : {}),
    };
  }

  private formatDateLabel(dateStr: string): string {
    if (dateStr === this.today) return 'Hoy';
    const d = new Date(dateStr + 'T00:00:00');
    const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
