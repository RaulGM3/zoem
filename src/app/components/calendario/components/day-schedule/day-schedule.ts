import {
  Component, ChangeDetectionStrategy, input, output,
  signal, computed, viewChild, ElementRef, afterNextRender,
} from '@angular/core';
import { LucideAngularModule, X, Clock } from 'lucide-angular';
import type { CalendarItem, EventGroup } from '../../calendario.types';

type HitoEstado = NonNullable<CalendarItem['hitoEstado']>;

export interface ItemTimeChange {
  id: string;
  casoId?: string;
  itemType: 'hito' | 'evento';
  horaInicio: string | null;
  duracionMinutos: number | null;
  date?: string; // nueva fecha si se arrastró a otra columna
}

interface DragState {
  item: CalendarItem;
  offsetMinutes: number;
  currentStartMinutes: number;
  originalStartMinutes: number;
  currentDate: string;
  originalDate: string;
}

interface ResizeState {
  item: CalendarItem;
  startY: number;
  originalDuration: number;
  currentDuration: number;
}

interface ItemLayout {
  colIndex: number;
  totalCols: number;
}

const HOUR_HEIGHT = 64;
const SNAP_MINUTES = 15;
const MIN_DURATION = 15;
const DEFAULT_DURATION = 60;
const DEFAULT_HOUR = 9;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function minutesToTime(total: number): string {
  const c = clamp(total, 0, 23 * 60 + 59);
  const h = Math.floor(c / 60);
  const m = c % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function minutesToPx(minutes: number): number {
  return (minutes / 60) * HOUR_HEIGHT;
}

function pxToMinutes(px: number): number {
  return (px / HOUR_HEIGHT) * 60;
}

/**
 * Greedy column packing para renderizar eventos superpuestos side-by-side.
 * Cada evento recibe { colIndex, totalCols } donde totalCols refleja el máximo
 * de solapamientos simultáneos en su rango de tiempo.
 */
function computeColumnLayout(items: CalendarItem[]): Map<string, ItemLayout> {
  const result = new Map<string, ItemLayout>();
  if (items.length === 0) return result;

  const sorted = [...items].sort(
    (a, b) => timeToMinutes(a.horaInicio!) - timeToMinutes(b.horaInicio!)
  );

  // Asignar columnas con greedy packing
  const colEnds: number[] = [];
  const itemCols = new Map<string, number>();

  for (const item of sorted) {
    const start = timeToMinutes(item.horaInicio!);
    const end = start + (item.duracionMinutos ?? DEFAULT_DURATION);
    let placed = false;
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= start) {
        colEnds[c] = end;
        itemCols.set(item.id, c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      itemCols.set(item.id, colEnds.length);
      colEnds.push(end);
    }
  }

  // totalCols = máx columna entre todos los eventos que se solapan con éste
  for (const item of sorted) {
    const start = timeToMinutes(item.horaInicio!);
    const end = start + (item.duracionMinutos ?? DEFAULT_DURATION);
    const colIndex = itemCols.get(item.id)!;
    let maxCol = colIndex;
    for (const other of sorted) {
      if (other.id === item.id) continue;
      const oStart = timeToMinutes(other.horaInicio!);
      const oEnd = oStart + (other.duracionMinutos ?? DEFAULT_DURATION);
      if (start < oEnd && end > oStart) {
        maxCol = Math.max(maxCol, itemCols.get(other.id)!);
      }
    }
    result.set(item.id, { colIndex, totalCols: maxCol + 1 });
  }

  return result;
}

@Component({
  selector: 'app-day-schedule',
  imports: [LucideAngularModule],
  templateUrl: './day-schedule.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayScheduleComponent {
  readonly groupedEvents = input.required<EventGroup[]>();
  readonly hasSelectedDates = input.required<boolean>();

  readonly itemTimeChanged = output<ItemTimeChange>();
  readonly hitoStatusChanged = output<{ id: string; casoId: string; estado: HitoEstado }>();

  readonly XIcon = X;
  readonly ClockIcon = Clock;

  readonly hours = HOURS;
  readonly hourHeight = HOUR_HEIGHT;
  readonly totalGridHeight = 24 * HOUR_HEIGHT;

  private readonly scheduleAreaRef = viewChild<ElementRef<HTMLDivElement>>('scheduleArea');
  private readonly headerRef = viewChild<ElementRef<HTMLDivElement>>('scheduleHeader');

  readonly dragging = signal<DragState | null>(null);
  readonly resizing = signal<ResizeState | null>(null);

  readonly unscheduledItems = computed<CalendarItem[]>(() =>
    this.groupedEvents().flatMap(g => g.items.filter(i => !i.horaInicio))
  );

  /** Layout de columnas por item (para eventos superpuestos side-by-side) */
  readonly layouts = computed<Map<string, ItemLayout>>(() => {
    const map = new Map<string, ItemLayout>();
    for (const group of this.groupedEvents()) {
      const scheduled = group.items.filter(i => !!i.horaInicio);
      computeColumnLayout(scheduled).forEach((layout, id) => map.set(id, layout));
    }
    return map;
  });

  constructor() {
    afterNextRender(() => {
      const area = this.scheduleAreaRef()?.nativeElement;
      if (area) area.scrollTop = minutesToPx(8 * 60); // scroll inicial a 08:00
    });
  }

  // ── consultas ────────────────────────────────────────────────────────

  scheduledItemsForDate(date: string): CalendarItem[] {
    const group = this.groupedEvents().find(g => g.date === date);
    return (group?.items ?? []).filter(i => !!i.horaInicio);
  }

  isDraggingItem(item: CalendarItem): boolean {
    return this.dragging()?.item.id === item.id;
  }

  isResizingItem(item: CalendarItem): boolean {
    return this.resizing()?.item.id === item.id;
  }

  // ── posición y dimensiones ───────────────────────────────────────────

  getItemTop(item: CalendarItem): number {
    return item.horaInicio ? minutesToPx(timeToMinutes(item.horaInicio)) : 0;
  }

  getDragTop(): number {
    const d = this.dragging();
    return d ? minutesToPx(d.currentStartMinutes) : 0;
  }

  getItemHeight(item: CalendarItem): number {
    return Math.max(minutesToPx(item.duracionMinutos ?? DEFAULT_DURATION), minutesToPx(MIN_DURATION));
  }

  getResizeHeight(): number {
    const r = this.resizing();
    return r ? Math.max(minutesToPx(r.currentDuration), minutesToPx(MIN_DURATION)) : 0;
  }

  getItemLeft(item: CalendarItem): string {
    const layout = this.layouts().get(item.id);
    if (!layout || layout.totalCols === 1) return '2px';
    return `calc(${(layout.colIndex / layout.totalCols) * 100}% + 2px)`;
  }

  getItemWidth(item: CalendarItem): string {
    const layout = this.layouts().get(item.id);
    if (!layout || layout.totalCols === 1) return 'calc(100% - 4px)';
    return `calc(${(1 / layout.totalCols) * 100}% - 4px)`;
  }

  // ── clases CSS ───────────────────────────────────────────────────────

  getItemClass(item: CalendarItem): string {
    const colors: Record<string, string> = {
      reunion:      'bg-violet-50 border-l-violet-500 text-violet-900',
      llamada:      'bg-green-50 border-l-green-500 text-green-900',
      entrega:      'bg-blue-50 border-l-blue-500 text-blue-900',
      recordatorio: 'bg-amber-50 border-l-amber-500 text-amber-900',
    };
    const color = colors[item.type] ?? 'bg-slate-50 border-l-slate-400 text-slate-900';
    const dragging = this.isDraggingItem(item) ? 'shadow-xl opacity-90 z-10' : 'z-[1]';
    return `absolute rounded-lg border-l-4 overflow-hidden select-none touch-none ${color} ${dragging}`;
  }

  getDragPreviewClass(item: CalendarItem): string {
    const borders: Record<string, string> = {
      reunion:      'border-violet-400 bg-violet-100/60 text-violet-800',
      llamada:      'border-green-400 bg-green-100/60 text-green-800',
      entrega:      'border-blue-400 bg-blue-100/60 text-blue-800',
      recordatorio: 'border-amber-400 bg-amber-100/60 text-amber-800',
    };
    return `pointer-events-none absolute rounded-lg border-2 border-dashed z-10 ${borders[item.type] ?? 'border-slate-400 bg-slate-100/60 text-slate-700'}`;
  }

  getHitoEstadoBadgeClass(estado: HitoEstado): string {
    const map: Record<HitoEstado, string> = {
      pendiente:   'bg-amber-100 text-amber-700',
      en_progreso: 'bg-blue-100 text-blue-700',
      completado:  'bg-green-100 text-green-700',
      cancelado:   'bg-slate-100 text-slate-500',
    };
    return map[estado] ?? 'bg-slate-100 text-slate-500';
  }

  getHitoEstadoLabel(estado: HitoEstado): string {
    const map: Record<HitoEstado, string> = {
      pendiente:   'Pte.',
      en_progreso: 'En proceso',
      completado:  '✓',
      cancelado:   '✗',
    };
    return map[estado] ?? estado;
  }

  // ── etiquetas de tiempo ──────────────────────────────────────────────

  formatHour(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  getTimeLabel(item: CalendarItem): string {
    if (!item.horaInicio) return '';
    const dur = item.duracionMinutos ?? DEFAULT_DURATION;
    return `${item.horaInicio} – ${minutesToTime(timeToMinutes(item.horaInicio) + dur)}`;
  }

  getDragTimeLabel(): string {
    const d = this.dragging();
    if (!d) return '';
    const dur = d.item.duracionMinutos ?? DEFAULT_DURATION;
    return `${minutesToTime(d.currentStartMinutes)} – ${minutesToTime(d.currentStartMinutes + dur)}`;
  }

  getResizeTimeLabel(): string {
    const r = this.resizing();
    if (!r?.item.horaInicio) return '';
    const mins = r.currentDuration;
    const dur = mins < 60
      ? `${mins} min`
      : `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`;
    return `${r.item.horaInicio} · ${dur}`;
  }

  // ── acciones ─────────────────────────────────────────────────────────

  /** Encuentra el primer slot libre desde las 09:00 para no solapar eventos existentes */
  private findAvailableSlot(item: CalendarItem): number {
    const scheduled = this.scheduledItemsForDate(item.date);
    let startMinutes = DEFAULT_HOUR * 60;

    const byTime = [...scheduled]
      .filter(i => !!i.horaInicio)
      .sort((a, b) => timeToMinutes(a.horaInicio!) - timeToMinutes(b.horaInicio!));

    for (const existing of byTime) {
      const eStart = timeToMinutes(existing.horaInicio!);
      const eEnd = eStart + (existing.duracionMinutos ?? DEFAULT_DURATION);
      if (startMinutes + DEFAULT_DURATION <= eStart) break;
      startMinutes = Math.max(startMinutes, eEnd);
    }

    return Math.min(startMinutes, 22 * 60);
  }

  scheduleItem(item: CalendarItem): void {
    this.itemTimeChanged.emit({
      id: item.id,
      casoId: item.casoId,
      itemType: item.hitoEstado !== undefined ? 'hito' : 'evento',
      horaInicio: minutesToTime(this.findAvailableSlot(item)),
      duracionMinutos: DEFAULT_DURATION,
    });
  }

  unscheduleItem(event: MouseEvent, item: CalendarItem): void {
    event.stopPropagation();
    this.itemTimeChanged.emit({
      id: item.id,
      casoId: item.casoId,
      itemType: item.hitoEstado !== undefined ? 'hito' : 'evento',
      horaInicio: null,
      duracionMinutos: null,
    });
  }

  advanceHito(event: MouseEvent, item: CalendarItem): void {
    event.stopPropagation();
    if (!item.casoId || !item.hitoEstado || item.hitoEstado === 'completado') return;
    const next: HitoEstado = item.hitoEstado === 'pendiente' ? 'en_progreso' : 'completado';
    this.hitoStatusChanged.emit({ id: item.id, casoId: item.casoId, estado: next });
  }

  // ── drag: mover ──────────────────────────────────────────────────────

  onItemPointerDown(event: PointerEvent, item: CalendarItem): void {
    if ((event.target as HTMLElement).closest('.resize-handle')) return;
    event.preventDefault();
    event.stopPropagation();

    const area = this.scheduleAreaRef()?.nativeElement;
    const header = this.headerRef()?.nativeElement;
    if (!area) return;

    const headerHeight = header?.offsetHeight ?? 40;
    const areaRect = area.getBoundingClientRect();
    const yInGrid = event.clientY - areaRect.top - headerHeight + area.scrollTop;
    const clickMinutes = pxToMinutes(yInGrid);
    const itemStart = item.horaInicio ? timeToMinutes(item.horaInicio) : 0;
    const dur = item.duracionMinutos ?? DEFAULT_DURATION;

    this.dragging.set({
      item,
      offsetMinutes: clamp(clickMinutes - itemStart, 0, dur - 1),
      currentStartMinutes: itemStart,
      originalStartMinutes: itemStart,
      currentDate: item.date,
      originalDate: item.date,
    });

    area.setPointerCapture(event.pointerId);
  }

  // ── drag: resize ─────────────────────────────────────────────────────

  onResizePointerDown(event: PointerEvent, item: CalendarItem): void {
    event.preventDefault();
    event.stopPropagation();

    const area = this.scheduleAreaRef()?.nativeElement;
    if (!area) return;

    this.resizing.set({
      item,
      startY: event.clientY,
      originalDuration: item.duracionMinutos ?? DEFAULT_DURATION,
      currentDuration: item.duracionMinutos ?? DEFAULT_DURATION,
    });

    area.setPointerCapture(event.pointerId);
  }

  // ── eventos de pointer globales ──────────────────────────────────────

  onSchedulePointerMove(event: PointerEvent): void {
    const drag = this.dragging();
    if (drag) { this.handleDragMove(event, drag); return; }
    const resize = this.resizing();
    if (resize) { this.handleResizeMove(event, resize); }
  }

  onSchedulePointerUp(_event: PointerEvent): void {
    const drag = this.dragging();
    if (drag) { this.finalizeDrag(drag); return; }
    const resize = this.resizing();
    if (resize) { this.finalizeResize(resize); }
  }

  onSchedulePointerCancel(): void {
    this.dragging.set(null);
    this.resizing.set(null);
  }

  private handleDragMove(event: PointerEvent, drag: DragState): void {
    const area = this.scheduleAreaRef()?.nativeElement;
    const header = this.headerRef()?.nativeElement;
    if (!area) return;

    const headerHeight = header?.offsetHeight ?? 40;
    const areaRect = area.getBoundingClientRect();
    const yInGrid = event.clientY - areaRect.top - headerHeight + area.scrollTop;
    const pointerMinutes = pxToMinutes(yInGrid);
    const dur = drag.item.duracionMinutos ?? DEFAULT_DURATION;
    const newStart = snap(clamp(pointerMinutes - drag.offsetMinutes, 0, 24 * 60 - dur));

    // Detectar columna (día) bajo el cursor
    const newDate = this.getDateAtPointer(event) ?? drag.currentDate;

    this.dragging.update(d =>
      d ? { ...d, currentStartMinutes: newStart, currentDate: newDate } : null
    );
  }

  private handleResizeMove(event: PointerEvent, resize: ResizeState): void {
    const deltaY = event.clientY - resize.startY;
    const deltaMins = pxToMinutes(deltaY);
    const newDur = snap(clamp(resize.originalDuration + deltaMins, MIN_DURATION, 23 * 60));
    this.resizing.update(r => r ? { ...r, currentDuration: newDur } : null);
  }

  private finalizeDrag(drag: DragState): void {
    this.dragging.set(null);
    const timeChanged = drag.currentStartMinutes !== drag.originalStartMinutes;
    const dateChanged = drag.currentDate !== drag.originalDate;
    if (!timeChanged && !dateChanged) return;

    this.itemTimeChanged.emit({
      id: drag.item.id,
      casoId: drag.item.casoId,
      itemType: drag.item.hitoEstado !== undefined ? 'hito' : 'evento',
      horaInicio: minutesToTime(drag.currentStartMinutes),
      duracionMinutos: drag.item.duracionMinutos ?? DEFAULT_DURATION,
      ...(dateChanged ? { date: drag.currentDate } : {}),
    });
  }

  private finalizeResize(resize: ResizeState): void {
    this.resizing.set(null);
    if (resize.currentDuration === resize.originalDuration) return;

    this.itemTimeChanged.emit({
      id: resize.item.id,
      casoId: resize.item.casoId,
      itemType: resize.item.hitoEstado !== undefined ? 'hito' : 'evento',
      horaInicio: resize.item.horaInicio!,
      duracionMinutos: resize.currentDuration,
    });
  }

  /** Devuelve el data-date de la columna bajo el cursor */
  private getDateAtPointer(event: PointerEvent): string | null {
    const area = this.scheduleAreaRef()?.nativeElement;
    if (!area) return null;
    const cols = area.querySelectorAll<HTMLElement>('[data-date]');
    for (const col of cols) {
      const rect = col.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX < rect.right) {
        return col.dataset['date'] ?? null;
      }
    }
    return null;
  }
}
