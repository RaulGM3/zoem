import {
  Component, ChangeDetectionStrategy, input, output,
  signal, computed, viewChild, ElementRef, effect,
} from '@angular/core';
import { LucideAngularModule, X, Clock, Trash2, Plus, Scissors, Euro, Flag, CalendarClock } from 'lucide-angular';
import type { Anotacion, CalendarItem, EventGroup, ItemColor } from '../../calendario.types';
import type { CompanyMember, EventoEstado, HitoEstado, RegistroHoraHito } from '../../../../interfaces';
import {
  HITO_ESTADOS,
  HITO_ESTADO_LABEL,
  HITO_ESTADO_BADGE_CLASS,
  HITO_OVERDUE_LABEL,
  HITO_OVERDUE_BADGE_CLASS,
  nextHitoEstado,
  isHitoOverdue,
} from '../../../../core/hitos/hito-estado';
import {
  EVENTO_ESTADOS,
  EVENTO_ESTADO_LABEL,
  EVENTO_ESTADO_BADGE_CLASS,
} from '../../../../interfaces';

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

/** Segmento de horas de un hito posicionado en una columna del grid. */
interface GridRegistro {
  reg: RegistroHoraHito;
  hitoId: string;
  casoId?: string;
  title: string;
  color: ItemColor;
  item: CalendarItem;
}

interface RegistroDragState {
  reg: RegistroHoraHito;
  hitoId: string;
  casoId?: string;
  offsetMinutes: number;
  currentStartMinutes: number;
  originalStartMinutes: number;
  currentDate: string;
  originalDate: string;
}

interface RegistroResizeState {
  reg: RegistroHoraHito;
  hitoId: string;
  casoId?: string;
  startY: number;
  originalDuration: number;
  currentDuration: number;
}

const TYPE_COLOR: Record<string, ItemColor> = {
  reunion:      'violet',
  llamada:      'green',
  entrega:      'blue',
  recordatorio: 'amber',
};

// Clases dark-mode-aware definidas en styles.css (var(--algo) / color-mix), no
// utilidades Tailwind de color fijo — esas se ven blancas en modo oscuro.
const COLOR_ITEM: Record<ItemColor, string> = {
  violet: 'evt-violet',
  indigo: 'evt-indigo',
  blue:   'evt-blue',
  green:  'evt-green',
  amber:  'evt-amber',
  red:    'evt-red',
  pink:   'evt-pink',
  slate:  'evt-slate',
};

const COLOR_DRAG: Record<ItemColor, string> = {
  violet: 'evt-violet-drag',
  indigo: 'evt-indigo-drag',
  blue:   'evt-blue-drag',
  green:  'evt-green-drag',
  amber:  'evt-amber-drag',
  red:    'evt-red-drag',
  pink:   'evt-pink-drag',
  slate:  'evt-slate-drag',
};

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

const HOUR_HEIGHT = 64;
const SNAP_MINUTES = 15;
const MIN_DURATION = 15;
const DEFAULT_DURATION = 60;
const DEFAULT_HOUR = 9;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  readonly members = input<CompanyMember[]>([]);
  /** Primer día del rango visible (YYYY-MM-DD). Usado para acotar "Sin programar". */
  readonly visibleRangeStart = input<string>('');
  /** Cantidad de días del rango visible. */
  readonly visibleRangeCount = input<number>(21);

  readonly itemTimeChanged = output<ItemTimeChange>();
  readonly hitoStatusChanged = output<{ id: string; casoId: string; estado: HitoEstado }>();
  readonly eventoStatusChanged = output<{ id: string; estado: EventoEstado }>();
  readonly annotationAdded = output<{ itemId: string; casoId?: string; texto: string }>();
  readonly annotationDeleted = output<{ itemId: string; casoId?: string; anotacionId: string }>();
  readonly itemColorChanged = output<{ id: string; color: ItemColor | null }>();
  readonly registrosChanged = output<{ hitoId: string; casoId?: string; registros: RegistroHoraHito[] }>();
  readonly eventoDeleted = output<{ id: string }>();

  readonly XIcon = X;
  readonly ClockIcon = Clock;
  readonly Trash2Icon = Trash2;
  readonly PlusIcon = Plus;
  readonly ScissorsIcon = Scissors;
  readonly EuroIcon = Euro;
  readonly FlagIcon = Flag;
  readonly CalendarClockIcon = CalendarClock;

  readonly HITO_ESTADOS = HITO_ESTADOS;
  readonly EVENTO_ESTADOS = EVENTO_ESTADOS;
  readonly ALL_COLORS = ALL_COLORS;

  private readonly today = todayStr();

  readonly hours = HOURS;
  readonly hourHeight = HOUR_HEIGHT;
  readonly totalGridHeight = 24 * HOUR_HEIGHT;

  private readonly scheduleAreaRef = viewChild<ElementRef<HTMLDivElement>>('scheduleArea');
  private readonly headerRef = viewChild<ElementRef<HTMLDivElement>>('scheduleHeader');

  readonly dragging = signal<DragState | null>(null);
  readonly resizing = signal<ResizeState | null>(null);
  readonly draggingReg = signal<RegistroDragState | null>(null);
  readonly resizingReg = signal<RegistroResizeState | null>(null);
  readonly selectedItem = signal<CalendarItem | null>(null);
  readonly newAnnotationText = signal('');
  readonly confirmingDelete = signal(false);

  /** Copia de trabajo de los registros de horas mientras el editor está abierto (null = cerrado). */
  readonly horasEditor = signal<RegistroHoraHito[] | null>(null);

  /** Total de horas de la copia de trabajo del editor. */
  readonly horasEditorTotal = computed(() => {
    const regs = this.horasEditor();
    if (!regs) return 0;
    const min = regs.reduce((s, r) => s + r.minutos, 0);
    return Math.round((min / 60) * 100) / 100;
  });

  // Un hito está "sin programar" si no tiene segmentos de horas; un evento, si no
  // tiene hora. Los hitos se representan por sus segmentos, no por horaAgenda.
  // Solo se muestran items cuya fecha cae dentro del rango visible para evitar
  // que hitos de semanas pasadas (todavía en selectedDates) saturen esta sección.
  readonly unscheduledItems = computed<CalendarItem[]>(() => {
    const rangeStart = this.visibleRangeStart();
    const rangeCount = this.visibleRangeCount();
    let rangeEnd = '';
    if (rangeStart) {
      const end = new Date(rangeStart + 'T00:00:00');
      end.setDate(end.getDate() + rangeCount - 1);
      rangeEnd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    }
    return this.groupedEvents().flatMap(g => g.items.filter(i => {
      const isUnscheduled = i.hitoEstado === undefined ? !i.horaInicio : (i.registrosHoras?.length ?? 0) === 0;
      if (!isUnscheduled) return false;
      if (!rangeStart || !rangeEnd) return true;
      return i.date >= rangeStart && i.date <= rangeEnd;
    }));
  });

  /**
   * Layout de columnas para colocar bloques superpuestos side-by-side. Incluye
   * tanto eventos (por su hora) como segmentos de hito (cada registro), de modo
   * que un evento y un segmento que coinciden en horario no se pisen.
   */
  readonly layouts = computed<Map<string, ItemLayout>>(() => {
    const map = new Map<string, ItemLayout>();
    const drag = this.draggingReg();
    for (const group of this.groupedEvents()) {
      const renderables: CalendarItem[] = [];
      for (const item of group.items) {
        if (item.hitoEstado === undefined) {
          if (item.horaInicio) renderables.push(item);
        } else {
          for (const r of item.registrosHoras ?? []) {
            const isDragging = drag?.reg.id === r.id;
            const fecha = isDragging ? drag!.currentDate : r.fecha;
            if (fecha === group.date) {
              const horaInicio = isDragging ? minutesToTime(drag!.currentStartMinutes) : r.horaInicio;
              renderables.push({ ...item, id: r.id, horaInicio, duracionMinutos: r.minutos });
            }
          }
        }
      }
      computeColumnLayout(renderables).forEach((layout, id) => map.set(id, layout));
    }
    return map;
  });

  constructor() {
    let scrolled = false;
    effect(() => {
      const area = this.scheduleAreaRef()?.nativeElement;
      if (area && !scrolled) {
        scrolled = true;
        const now = new Date();
        const targetHour = Math.max(0, now.getHours() - 2);
        area.scrollTop = minutesToPx(targetHour * 60);
      }
    });
  }

  // ── consultas ────────────────────────────────────────────────────────

  /** Eventos agendados de una fecha. Los hitos se rinden por segmentos, no aquí. */
  scheduledItemsForDate(date: string): CalendarItem[] {
    const group = this.groupedEvents().find(g => g.date === date);
    return (group?.items ?? []).filter(i => i.hitoEstado === undefined && !!i.horaInicio);
  }

  /** ¿Es un hito (vs un evento)? Fuente: la presencia de hitoEstado. */
  isHito(item: CalendarItem): boolean {
    return item.hitoEstado !== undefined;
  }

  // ── registros de horas en el grid ────────────────────────────────────

  /** Segmentos de hito (registrosHoras) que caen en una fecha concreta. */
  gridRegistrosForDate(date: string): GridRegistro[] {
    const result: GridRegistro[] = [];
    const seen = new Set<string>();
    for (const g of this.groupedEvents()) {
      for (const item of g.items) {
        if (item.hitoEstado === undefined) continue; // solo hitos
        for (const r of item.registrosHoras ?? []) {
          if (r.fecha === date && !seen.has(r.id)) {
            seen.add(r.id);
            result.push({ reg: r, hitoId: item.id, casoId: item.casoId, title: item.title, color: this.effectiveColor(item), item });
          }
        }
      }
    }
    return result;
  }

  /** Layout (left/width) de un segmento dentro de su columna, vía el mapa compartido. */
  getRegLeft(r: RegistroHoraHito): string {
    const layout = this.layouts().get(r.id);
    if (!layout || layout.totalCols === 1) return '2px';
    return `calc(${(layout.colIndex / layout.totalCols) * 100}% + 2px)`;
  }

  getRegWidth(r: RegistroHoraHito): string {
    const layout = this.layouts().get(r.id);
    if (!layout || layout.totalCols === 1) return 'calc(100% - 4px)';
    return `calc(${(1 / layout.totalCols) * 100}% - 4px)`;
  }

  private findItemById(hitoId: string): CalendarItem | null {
    for (const g of this.groupedEvents()) {
      const found = g.items.find(i => i.id === hitoId);
      if (found) return found;
    }
    return null;
  }

  isDraggingReg(r: RegistroHoraHito): boolean {
    return this.draggingReg()?.reg.id === r.id;
  }

  isResizingReg(r: RegistroHoraHito): boolean {
    return this.resizingReg()?.reg.id === r.id;
  }

  getRegTop(r: RegistroHoraHito): number {
    const d = this.draggingReg();
    if (d?.reg.id === r.id) return minutesToPx(d.currentStartMinutes);
    return minutesToPx(timeToMinutes(r.horaInicio));
  }

  /** Top de la sombra fantasma del segmento (posición original, sin drag). */
  getRegGhostTop(r: RegistroHoraHito): number {
    return minutesToPx(timeToMinutes(r.horaInicio));
  }

  getRegHeight(r: RegistroHoraHito): number {
    const rz = this.resizingReg();
    const mins = rz?.reg.id === r.id ? rz.currentDuration : r.minutos;
    return Math.max(minutesToPx(mins), minutesToPx(MIN_DURATION));
  }

  getRegTimeLabel(r: RegistroHoraHito): string {
    const d = this.draggingReg();
    if (d?.reg.id === r.id) {
      const dur = d.reg.minutos;
      return `${minutesToTime(d.currentStartMinutes)} – ${minutesToTime(d.currentStartMinutes + dur)}`;
    }
    const rz = this.resizingReg();
    if (rz?.reg.id === r.id) {
      return `${r.horaInicio} – ${minutesToTime(timeToMinutes(r.horaInicio) + rz.currentDuration)}`;
    }
    return `${r.horaInicio} – ${r.horaFin}`;
  }

  private makeRegistro(userId: string, fecha: string, startMin: number, dur: number): RegistroHoraHito {
    return {
      id: this.newRegistroId(),
      userId,
      fecha,
      horaInicio: minutesToTime(startMin),
      horaFin: minutesToTime(startMin + dur),
      minutos: dur,
    };
  }

  /**
   * "Separar": crea un nuevo segmento del hito a continuación del actual, dejando
   * un hueco de 1h (la pausa para comer/descansar). El usuario luego lo arrastra
   * y redimensiona donde le convenga (p.ej. 10–12 y 13–14).
   */
  splitRegistro(event: Event, gr: GridRegistro): void {
    event.stopPropagation();
    const item = this.findItemById(gr.hitoId);
    if (!item) return;
    const gapStart = timeToMinutes(gr.reg.horaFin) + 60;
    const start = clamp(gapStart, 0, 23 * 60);
    const nuevo = this.makeRegistro(gr.reg.userId, gr.reg.fecha, start, DEFAULT_DURATION);
    const registros = [...(item.registrosHoras ?? []), nuevo];
    this.registrosChanged.emit({ hitoId: item.id, casoId: item.casoId, registros });
  }

  /** Borra un segmento (separación) del hito. Si era el último, queda sin programar. */
  removeRegistro(event: Event, gr: GridRegistro): void {
    event.stopPropagation();
    const item = this.findItemById(gr.hitoId);
    if (!item) return;
    const registros = (item.registrosHoras ?? []).filter(r => r.id !== gr.reg.id);
    if (registros.length === 0) return;
    this.registrosChanged.emit({ hitoId: item.id, casoId: item.casoId, registros });
  }

  onRegistroPointerDown(event: PointerEvent, gr: GridRegistro): void {
    if (gr.reg.facturado) return; // los facturados son inmutables
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
    const start = timeToMinutes(gr.reg.horaInicio);

    this.draggingReg.set({
      reg: gr.reg,
      hitoId: gr.hitoId,
      casoId: gr.casoId,
      offsetMinutes: clamp(clickMinutes - start, 0, gr.reg.minutos - 1),
      currentStartMinutes: start,
      originalStartMinutes: start,
      currentDate: gr.reg.fecha,
      originalDate: gr.reg.fecha,
    });
    area.setPointerCapture(event.pointerId);
  }

  onRegistroResizePointerDown(event: PointerEvent, gr: GridRegistro): void {
    if (gr.reg.facturado) return;
    event.preventDefault();
    event.stopPropagation();
    const area = this.scheduleAreaRef()?.nativeElement;
    if (!area) return;
    this.resizingReg.set({
      reg: gr.reg,
      hitoId: gr.hitoId,
      casoId: gr.casoId,
      startY: event.clientY,
      originalDuration: gr.reg.minutos,
      currentDuration: gr.reg.minutos,
    });
    area.setPointerCapture(event.pointerId);
  }

  private handleRegDragMove(event: PointerEvent, drag: RegistroDragState): void {
    const area = this.scheduleAreaRef()?.nativeElement;
    const header = this.headerRef()?.nativeElement;
    if (!area) return;
    const headerHeight = header?.offsetHeight ?? 40;
    const areaRect = area.getBoundingClientRect();
    const yInGrid = event.clientY - areaRect.top - headerHeight + area.scrollTop;
    const pointerMinutes = pxToMinutes(yInGrid);
    const dur = drag.reg.minutos;
    const newStart = snap(clamp(pointerMinutes - drag.offsetMinutes, 0, 24 * 60 - dur));
    const newDate = this.getDateAtPointer(event) ?? drag.currentDate;
    this.draggingReg.update(d => d ? { ...d, currentStartMinutes: newStart, currentDate: newDate } : null);
  }

  private handleRegResizeMove(event: PointerEvent, resize: RegistroResizeState): void {
    const deltaY = event.clientY - resize.startY;
    const deltaMins = pxToMinutes(deltaY);
    const newDur = snap(clamp(resize.originalDuration + deltaMins, MIN_DURATION, 23 * 60));
    this.resizingReg.update(r => r ? { ...r, currentDuration: newDur } : null);
  }

  private finalizeRegDrag(drag: RegistroDragState): void {
    this.draggingReg.set(null);
    const item = this.findItemById(drag.hitoId);
    const timeChanged = drag.currentStartMinutes !== drag.originalStartMinutes;
    const dateChanged = drag.currentDate !== drag.originalDate;
    if (!timeChanged && !dateChanged) {
      // Click sin arrastrar → abre el detalle del hito.
      if (item) this.selectedItem.set(item);
      return;
    }
    if (!item) return;
    const dur = drag.reg.minutos;
    const start = drag.currentStartMinutes;
    const updated: RegistroHoraHito = {
      ...drag.reg,
      fecha: drag.currentDate,
      horaInicio: minutesToTime(start),
      horaFin: minutesToTime(start + dur),
      minutos: dur,
    };
    const registros = (item.registrosHoras ?? []).map(r => r.id === drag.reg.id ? updated : r);
    this.registrosChanged.emit({ hitoId: drag.hitoId, casoId: drag.casoId, registros });
  }

  private finalizeRegResize(resize: RegistroResizeState): void {
    this.resizingReg.set(null);
    if (resize.currentDuration === resize.originalDuration) return;
    const item = this.findItemById(resize.hitoId);
    if (!item) return;
    const start = timeToMinutes(resize.reg.horaInicio);
    const updated: RegistroHoraHito = {
      ...resize.reg,
      horaFin: minutesToTime(start + resize.currentDuration),
      minutos: resize.currentDuration,
    };
    const registros = (item.registrosHoras ?? []).map(r => r.id === resize.reg.id ? updated : r);
    this.registrosChanged.emit({ hitoId: resize.hitoId, casoId: resize.casoId, registros });
  }

  getRegClass(gr: GridRegistro): string {
    const color = COLOR_ITEM[gr.color];
    const dragging = this.isDraggingReg(gr.reg) ? 'shadow-xl opacity-90 z-20' : 'z-[2]';
    const cursor = gr.reg.facturado ? 'cursor-default' : 'cursor-grab';
    // Mismo estilo que un bloque de hito (color + borde izq.); el segmento ES el hito.
    return `absolute rounded-lg border-l-4 overflow-hidden select-none touch-none ${color} ${cursor} ${dragging}`;
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

  private effectiveColor(item: CalendarItem): ItemColor {
    return item.color ?? TYPE_COLOR[item.type] ?? 'slate';
  }

  getItemClass(item: CalendarItem): string {
    const color = COLOR_ITEM[this.effectiveColor(item)];
    const dragging = this.isDraggingItem(item) ? 'shadow-xl opacity-90 z-10' : 'z-[1]';
    return `absolute rounded-lg border-l-4 overflow-hidden select-none touch-none ${color} ${dragging}`;
  }

  getDragPreviewClass(item: CalendarItem): string {
    const drag = COLOR_DRAG[this.effectiveColor(item)];
    return `pointer-events-none absolute rounded-lg border-2 border-dashed z-10 ${drag}`;
  }

  getRegDragPreviewClass(hitoId: string): string {
    const item = this.findItemById(hitoId);
    return item ? this.getDragPreviewClass(item) : 'pointer-events-none absolute rounded-lg border-2 border-dashed z-10';
  }

  // ── estado (badge en el bloque) ──────────────────────────────────────
  // Fuente de verdad única: hito-estado.ts y evento.interface.ts. No reinventar
  // mapas locales — antes esto mostraba 'Pte.'/'✓' divergentes del resto de la app.

  isHitoOverdue(item: CalendarItem): boolean {
    return isHitoOverdue(item.hitoEstado, item.date, this.today);
  }

  /** Etiqueta del badge de estado del hito en el bloque (incluye "Vencido"). */
  getHitoBadgeLabel(item: CalendarItem): string {
    if (this.isHitoOverdue(item)) return HITO_OVERDUE_LABEL;
    return HITO_ESTADO_LABEL[item.hitoEstado!];
  }

  getHitoBadgeClass(item: CalendarItem): string {
    if (this.isHitoOverdue(item)) return HITO_OVERDUE_BADGE_CLASS;
    return HITO_ESTADO_BADGE_CLASS[item.hitoEstado!];
  }

  getEventoBadgeLabel(estado: EventoEstado): string {
    return EVENTO_ESTADO_LABEL[estado];
  }

  getEventoBadgeClass(estado: EventoEstado): string {
    return EVENTO_ESTADO_BADGE_CLASS[estado];
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
    const start = this.findAvailableSlot(item);
    if (item.hitoEstado !== undefined) {
      // Un hito se programa creando su primer segmento de horas.
      const userId = item.asignadosA?.[0] ?? this.members()[0]?.userId ?? '';
      const reg = this.makeRegistro(userId, item.date, start, DEFAULT_DURATION);
      this.registrosChanged.emit({ hitoId: item.id, casoId: item.casoId, registros: [reg] });
      return;
    }
    this.itemTimeChanged.emit({
      id: item.id,
      casoId: item.casoId,
      itemType: 'evento',
      horaInicio: minutesToTime(start),
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
    this.hitoStatusChanged.emit({
      id: item.id,
      casoId: item.casoId,
      estado: nextHitoEstado(item.hitoEstado),
    });
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
    if (resize) { this.handleResizeMove(event, resize); return; }
    const dragReg = this.draggingReg();
    if (dragReg) { this.handleRegDragMove(event, dragReg); return; }
    const resizeReg = this.resizingReg();
    if (resizeReg) { this.handleRegResizeMove(event, resizeReg); }
  }

  onSchedulePointerUp(_event: PointerEvent): void {
    const drag = this.dragging();
    if (drag) { this.finalizeDrag(drag); return; }
    const resize = this.resizing();
    if (resize) { this.finalizeResize(resize); return; }
    const dragReg = this.draggingReg();
    if (dragReg) { this.finalizeRegDrag(dragReg); return; }
    const resizeReg = this.resizingReg();
    if (resizeReg) { this.finalizeRegResize(resizeReg); }
  }

  onSchedulePointerCancel(): void {
    this.dragging.set(null);
    this.resizing.set(null);
    this.draggingReg.set(null);
    this.resizingReg.set(null);
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
    if (!timeChanged && !dateChanged) {
      this.selectedItem.set(drag.item);
      return;
    }

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

  // ── modal ────────────────────────────────────────────────────────────

  closeModal(): void {
    this.selectedItem.set(null);
    this.newAnnotationText.set('');
    this.horasEditor.set(null);
    this.confirmingDelete.set(false);
  }

  requestDeleteEvento(): void {
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  confirmDeleteEvento(): void {
    const item = this.selectedItem();
    if (!item) return;
    this.eventoDeleted.emit({ id: item.id });
    this.closeModal();
  }

  // ── editor de horas (cobro por horas) ────────────────────────────────

  private newRegistroId(): string {
    return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

  private bloqueDefault(item: CalendarItem, fecha: string): RegistroHoraHito {
    const userId = item.asignadosA?.[0] ?? this.members()[0]?.userId ?? '';
    const horaInicio = item.horaInicio ?? '09:00';
    const fin = timeToMinutes(horaInicio) + (item.duracionMinutos ?? DEFAULT_DURATION);
    const horaFin = minutesToTime(fin);
    return {
      id: this.newRegistroId(),
      userId,
      fecha,
      horaInicio,
      horaFin,
      minutos: Math.max(0, fin - timeToMinutes(horaInicio)),
    };
  }

  /** Abre el editor de horas sembrando la copia de trabajo desde el hito. */
  openHorasEditor(): void {
    const item = this.selectedItem();
    if (!item) return;
    const existentes = (item.registrosHoras ?? []).map(r => ({ ...r }));
    this.horasEditor.set(existentes.length > 0 ? existentes : [this.bloqueDefault(item, item.date)]);
  }

  cancelHorasEditor(): void {
    this.horasEditor.set(null);
  }

  addBloque(): void {
    const item = this.selectedItem();
    if (!item) return;
    this.horasEditor.update(regs => regs ? [...regs, this.bloqueDefault(item, item.date)] : regs);
  }

  /** "Separar": duplica un bloque en el día siguiente para repartir el trabajo. */
  splitBloque(id: string): void {
    this.horasEditor.update(regs => {
      if (!regs) return regs;
      const src = regs.find(r => r.id === id);
      if (!src) return regs;
      const next = new Date(src.fecha + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      const fecha = next.toISOString().slice(0, 10);
      return [...regs, { ...src, id: this.newRegistroId(), fecha }];
    });
  }

  removeBloque(id: string): void {
    this.horasEditor.update(regs => regs ? regs.filter(r => r.id !== id) : regs);
  }

  private recomputeMinutos(r: RegistroHoraHito): number {
    return Math.max(0, timeToMinutes(r.horaFin) - timeToMinutes(r.horaInicio));
  }

  updateBloqueField(id: string, field: 'fecha' | 'horaInicio' | 'horaFin' | 'userId', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.horasEditor.update(regs => {
      if (!regs) return regs;
      return regs.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value } as RegistroHoraHito;
        updated.minutos = this.recomputeMinutos(updated);
        return updated;
      });
    });
  }

  /** Persiste los registros (descarta los facturados, que son inmutables, conservándolos). */
  saveHoras(): void {
    const item = this.selectedItem();
    const regs = this.horasEditor();
    if (!item || !regs) return;
    const limpios = regs.filter(r => r.minutos > 0 && r.userId);
    this.registrosChanged.emit({ hitoId: item.id, casoId: item.casoId, registros: limpios });
    this.selectedItem.update(i => i ? { ...i, registrosHoras: limpios } : null);
    this.horasEditor.set(null);
  }

  /** Nombre del miembro a partir de su userId (para el desplegable y resúmenes). */
  memberName(userId: string): string {
    return this.members().find(m => m.userId === userId)?.nombre ?? 'Sin asignar';
  }

  bloqueHoras(r: RegistroHoraHito): number {
    return Math.round((r.minutos / 60) * 100) / 100;
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
    return COLOR_DOT[this.effectiveColor(item)];
  }

  getColorSwatchClass(color: ItemColor, isActive: boolean): string {
    return `${COLOR_SWATCH[color]}${isActive ? ' ring-2 ring-offset-2 scale-110' : ''}`;
  }

  setItemColor(color: ItemColor | null): void {
    const item = this.selectedItem();
    if (!item) return;
    this.itemColorChanged.emit({ id: item.id, color });
    this.selectedItem.update(i => i ? { ...i, color: color ?? undefined } : null);
  }

  setHitoEstado(estado: HitoEstado): void {
    const item = this.selectedItem();
    if (!item?.casoId) return;
    this.hitoStatusChanged.emit({ id: item.id, casoId: item.casoId, estado });
    this.selectedItem.update(i => i ? { ...i, hitoEstado: estado } : null);
  }

  setEventoEstado(estado: EventoEstado): void {
    const item = this.selectedItem();
    if (!item) return;
    this.eventoStatusChanged.emit({ id: item.id, estado });
    this.selectedItem.update(i => i ? { ...i, eventoEstado: estado } : null);
  }

  addAnnotation(): void {
    const texto = this.newAnnotationText().trim();
    const item = this.selectedItem();
    if (!texto || !item) return;
    this.annotationAdded.emit({ itemId: item.id, casoId: item.casoId, texto });
    const anotacion: Anotacion = { id: String(Date.now()), texto, creadaEn: new Date().toISOString() };
    this.selectedItem.update(i => i ? { ...i, anotaciones: [...(i.anotaciones ?? []), anotacion] } : null);
    this.newAnnotationText.set('');
  }

  deleteAnnotation(anotacionId: string): void {
    const item = this.selectedItem();
    if (!item) return;
    this.annotationDeleted.emit({ itemId: item.id, casoId: item.casoId, anotacionId });
    this.selectedItem.update(i =>
      i ? { ...i, anotaciones: (i.anotaciones ?? []).filter(a => a.id !== anotacionId) } : null
    );
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
