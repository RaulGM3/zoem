import {
  Component, signal, computed,
  ChangeDetectionStrategy, inject, viewChild, DestroyRef,
} from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, filter, map, switchMap } from 'rxjs';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { CasosService } from '../../core/services/casos.service';
import { CompanyService } from '../../core/services/company.service';
import { EventosService } from '../../core/services/eventos.service';
import { ToastService } from '../../core/services/toast.service';
import { UserSyncService } from '../../core/services/user-sync.service';
import { UsersService } from '../../core/services/users';
import { HITO_ESTADO_CALENDAR_STATUS, stampEstadoChange } from '../../core/hitos/hito-estado';
import type { Anotacion, CreateEventoData, Evento, EventoColor, EventoEstado, Hito, HitoEstado, RegistroHoraHito } from '../../interfaces';
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
  private readonly toast = inject(ToastService);
  private readonly companyService = inject(CompanyService);
  private readonly eventosService = inject(EventosService);
  private readonly userSync = inject(UserSyncService);
  private readonly usersService = inject(UsersService);
  private readonly nav = viewChild(CalendarNavComponent);

  /** Miembros del despacho — para asignar y registrar horas en los hitos. */
  readonly members = this.usersService.members;

  private readonly destroyRef = inject(DestroyRef);

  readonly PlusIcon = Plus;
  readonly dayNames = DAY_NAMES;
  /**
   * Fecha de "hoy" reactiva — se recalcula periódicamente para que "isToday" y
   * `isHitoOverdue` no queden congelados en el día en que se montó el
   * componente si la pestaña se deja abierta durante la medianoche.
   */
  readonly today = signal(localDateStr(new Date()));

  readonly showDrawer = signal(false);
  readonly saving = signal(false);

  constructor() {
    this.usersService.loadMembers();
    const intervalId = setInterval(() => this.today.set(localDateStr(new Date())), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

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
    const unscheduledDates = new Set(
      items
        .filter(i => i.hitoEstado !== undefined && (i.registrosHoras?.length ?? 0) === 0)
        .map(i => i.date),
    );
    return Array.from({ length: this.stripDayCount() }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const date = localDateStr(d);
      return {
        date,
        dayName: DAY_NAMES[i % 7],
        dayNum: d.getDate(),
        hasEvents: items.some(e => e.date === date),
        hasUnscheduledHitos: unscheduledDates.has(date),
        isToday: date === this.today(),
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
    const unscheduledDates = new Set(
      items
        .filter(i => i.hitoEstado !== undefined && (i.registrosHoras?.length ?? 0) === 0)
        .map(i => i.date),
    );

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      const date = localDateStr(d);
      return {
        date,
        dayName: DAY_NAMES[i % 7],
        dayNum: d.getDate(),
        hasEvents: items.some(e => e.date === date),
        hasUnscheduledHitos: unscheduledDates.has(date),
        isToday: date === this.today(),
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
      if (e.hitoEstado !== undefined && (e.registrosHoras?.length ?? 0) > 0) {
        // Hito con registros: colocarlo en cada fecha seleccionada donde tenga un registro.
        // Su fechaEstimada puede diferir si se arrastró el bloque a otro día, por lo que
        // no se puede usar e.date como fuente de verdad de la posición en el grid.
        const placed = new Set<string>();
        for (const r of e.registrosHoras!) {
          if (selected.has(r.fecha) && !placed.has(r.fecha)) {
            grouped.get(r.fecha)!.push(e);
            placed.add(r.fecha);
          }
        }
      } else if (selected.has(e.date)) {
        grouped.get(e.date)!.push(e);
      }
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
    } else {
      this.stripDayCount.set(42);
    }
    // Un día seleccionado en la vista anterior puede no existir/ser visible en
    // la nueva vista — evita que siga contaminando groupedEvents/unscheduledItems.
    this.selectedDates.set(new Set());
    this.viewMode.set(mode);
  }

  prevWeek(): void {
    const d = new Date(this.currentWeekStart() + 'T00:00:00');
    if (this.viewMode() === 'month') {
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      this.currentWeekStart.set(localDateStr(d));
      this.stripDayCount.set(42);
      this.selectedDates.set(new Set());
    } else {
      d.setDate(d.getDate() - 7);
      const newStart = localDateStr(d);
      this.currentWeekStart.set(newStart);
      this.visibleMonthDate.set(newStart);
      this.stripDayCount.set(21);
      this.selectedDates.set(new Set());
      this.nav()?.scrollToStart();
    }
  }

  nextWeek(): void {
    const d = new Date(this.currentWeekStart() + 'T00:00:00');
    if (this.viewMode() === 'month') {
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      this.currentWeekStart.set(localDateStr(d));
      this.stripDayCount.set(42);
      this.selectedDates.set(new Set());
    } else {
      d.setDate(d.getDate() + 7);
      const newStart = localDateStr(d);
      this.currentWeekStart.set(newStart);
      this.visibleMonthDate.set(newStart);
      this.stripDayCount.set(21);
      this.selectedDates.set(new Set());
      this.nav()?.scrollToStart();
    }
  }

  async updateHitoEstado(event: { id: string; casoId: string; estado: HitoEstado }): Promise<void> {
    // Solo persiste: el stream real-time refleja el cambio en el read model.
    await this.toast.run(
      () => this.casosService.updateHito(event.casoId, event.id, {
        estado: event.estado,
        ...stampEstadoChange(this.userSync.currentUser()?.id),
      }),
      { errorTitle: 'No se pudo cambiar el estado del hito' }
    );
  }

  async updateEventoEstado(event: { id: string; estado: EventoEstado }): Promise<void> {
    await this.toast.run(() => this.eventosService.updateEvento(event.id, { estado: event.estado }), {
      errorTitle: 'No se pudo cambiar el estado del evento',
    });
  }

  async updateItemTime(event: ItemTimeChange): Promise<void> {
    await this.toast.run(
      async () => {
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
      },
      { errorTitle: 'No se pudo actualizar la agenda' }
    );
  }

  async onSaveEvento(data: CreateEventoData): Promise<void> {
    this.saving.set(true);
    try {
      await this.toast.run(() => this.eventosService.createEvento(data), {
        successMessage: this.eventSuccessMessage(data.fecha),
        errorTitle: 'No se pudo crear el evento',
        onSuccess: () => {
          this.showDrawer.set(false);
          this.navigateToDate(data.fecha);
        },
      });
    } finally {
      this.saving.set(false);
    }
  }

  private navigateToDate(date: string): void {
    const monday = mondayOf(new Date(date + 'T00:00:00'));
    this.currentWeekStart.set(monday);
    this.visibleMonthDate.set(monday);
    this.stripDayCount.set(21);
    this.selectedDates.set(new Set([date]));
    this.nav()?.scrollToStart();
  }

  private eventSuccessMessage(date: string): string {
    const d = new Date(date + 'T00:00:00');
    const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return `Evento creado · ${label.charAt(0).toUpperCase() + label.slice(1)}`;
  }

  async onDeleteEvento({ id }: { id: string }): Promise<void> {
    await this.toast.run(() => this.eventosService.deleteEvento(id), {
      successMessage: 'Evento eliminado',
      errorTitle: 'No se pudo eliminar el evento',
    });
  }

  async updateItemColor({ id, color }: { id: string; color: ItemColor | null }): Promise<void> {
    const item = this.allItems().find(i => i.id === id);
    if (!item) return;
    await this.toast.run(
      () => (item.hitoEstado !== undefined && item.casoId)
        ? this.casosService.updateHito(item.casoId, id, { calendarColor: color })
        : this.eventosService.updateEvento(id, { calendarColor: color }),
      { errorTitle: 'No se pudo cambiar el color' }
    );
  }

  private eventoToItem(e: Evento): CalendarItem {
    const estado: EventoEstado = e.estado ?? 'confirmado';
    // El color del evento elegido al crearlo (EventoColor) es la base; el
    // calendarColor — override específico del calendario — gana si existe.
    const color = (e.calendarColor as ItemColor | undefined) ?? mapEventoColor(e.color);
    return {
      id: e.id,
      title: e.titulo,
      client: e.horaInicio ?? 'Todo el día',
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
      ...(e.anotaciones ? { anotaciones: e.anotaciones } : {}),
    };
  }

  private hitoToItem(h: Hito): CalendarItem {
    // Los hitos se representan en el grid por sus SEGMENTOS de horas (registrosHoras).
    // Compat: si un hito legacy sólo tiene horaAgenda, sintetizamos un segmento para
    // que siga apareciendo; al arrastrarlo/separarlo se materializa en registrosHoras.
    let registrosHoras = h.registrosHoras;
    if ((!registrosHoras || registrosHoras.length === 0) && h.horaAgenda && h.fechaEstimada) {
      const start = timeToMinutes(h.horaAgenda);
      const dur = h.duracionAgenda ?? 60;
      registrosHoras = [{
        id: `${h.id}_agenda`,
        userId: h.asignadosA?.[0] ?? h.asignadoA ?? '',
        fecha: h.fechaEstimada,
        horaInicio: h.horaAgenda,
        horaFin: minutesToTime(start + dur),
        minutos: dur,
      }];
    }
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
      ...(h.calendarColor ? { color: h.calendarColor as ItemColor } : {}),
      ...(h.asignadosA ? { asignadosA: h.asignadosA } : {}),
      ...(registrosHoras ? { registrosHoras } : {}),
      ...(h.anotaciones ? { anotaciones: h.anotaciones } : {}),
    };
  }

  /** Persiste los registros de horas declarados desde el editor del calendario. */
  async updateRegistrosHoras(event: { hitoId: string; registros: RegistroHoraHito[] }): Promise<void> {
    await this.toast.run(() => this.casosService.setRegistrosHoras(event.hitoId, event.registros), {
      errorTitle: 'No se pudieron guardar las horas',
    });
  }

  /** Añade una anotación al hito/evento subyacente. El stream refleja el cambio. */
  async onAnnotationAdded(event: { itemId: string; casoId?: string; texto: string }): Promise<void> {
    await this.toast.run(
      async () => {
        const item = this.allItems().find(i => i.id === event.itemId);
        const anotacion: Anotacion = {
          id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          texto: event.texto,
          ...(this.userSync.currentUser()?.id ? { autor: this.userSync.currentUser()!.id } : {}),
          creadaEn: new Date().toISOString(),
        };
        const anotaciones = [...(item?.anotaciones ?? []), anotacion];
        if (item?.hitoEstado !== undefined && event.casoId) {
          await this.casosService.updateHito(event.casoId, event.itemId, { anotaciones });
        } else {
          await this.eventosService.updateEvento(event.itemId, { anotaciones });
        }
      },
      { errorTitle: 'No se pudo añadir la anotación' }
    );
  }

  /** Elimina una anotación del hito/evento subyacente. El stream refleja el cambio. */
  async onAnnotationDeleted(event: { itemId: string; casoId?: string; anotacionId: string }): Promise<void> {
    await this.toast.run(
      async () => {
        const item = this.allItems().find(i => i.id === event.itemId);
        const anotaciones = (item?.anotaciones ?? []).filter(a => a.id !== event.anotacionId);
        if (item?.hitoEstado !== undefined && event.casoId) {
          await this.casosService.updateHito(event.casoId, event.itemId, { anotaciones });
        } else {
          await this.eventosService.updateEvento(event.itemId, { anotaciones });
        }
      },
      { errorTitle: 'No se pudo eliminar la anotación' }
    );
  }

  private formatDateLabel(dateStr: string): string {
    if (dateStr === this.today()) return 'Hoy';
    const d = new Date(dateStr + 'T00:00:00');
    const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
