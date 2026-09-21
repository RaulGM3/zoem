import {
  Component, ChangeDetectionStrategy, input, output, computed, signal, linkedSignal,
} from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import {
  LucideAngularModule, Plus, Trash2, X, CheckCircle2, CircleAlert, GripVertical, Eye, EyeOff, Check,
  Pencil, Search, SlidersHorizontal, ArrowUp, ArrowDown, ChevronsUpDown, Info,
} from 'lucide-angular';
import type {
  CuentaBancaria, GestoriaSlot, MovimientoGestoria, MovimientoTipo, ResumenFinanciero,
} from '../../../../interfaces';
import {
  FILTRO_MOVIMIENTOS_VACIO, ORDEN_MOVIMIENTOS_DEFECTO, SIN_CUENTA,
  filtrarYOrdenar, hayFiltroActivo, contarPorTipo,
  type CampoOrden, type DireccionFiltro, type FiltroMovimientos, type OrdenMovimientos,
} from '../../../../core/tesoreria/filtro-movimientos';

@Component({
  selector: 'app-caso-gestoria-tab',
  host: {
    style: 'display: block',
    '(document:keydown.escape)': 'onEscape()',
  },
  imports: [LucideAngularModule, DecimalPipe, TitleCasePipe],
  templateUrl: './caso-gestoria-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoGestoriaTabComponent {
  readonly slots = input.required<GestoriaSlot[]>();
  readonly movimientos = input.required<MovimientoGestoria[]>();
  readonly movimientosLoading = input.required<boolean>();
  readonly resumen = input.required<ResumenFinanciero>();
  readonly miembros = input<ReadonlyMap<string, string>>(new Map());
  readonly cuentas = input<CuentaBancaria[]>([]);
  /** Gating de permisos (mirroring de `Casos.editar`/`Casos.eliminar`); oculta acciones si no aplica. */
  readonly canEdit = input(true);
  readonly canDelete = input(true);

  readonly registerSlot = output<GestoriaSlot>();
  readonly unregisterSlot = output<GestoriaSlot>();
  readonly addMov = output<void>();
  readonly deleteMov = output<string>();
  readonly editMov = output<MovimientoGestoria>();
  readonly reorderSlots = output<GestoriaSlot[]>();

  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;
  readonly CheckIcon = Check;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly CircleAlertIcon = CircleAlert;
  readonly GripVerticalIcon = GripVertical;
  readonly EyeIcon = Eye;
  readonly EyeOffIcon = EyeOff;
  readonly PencilIcon = Pencil;
  readonly SearchIcon = Search;
  readonly SlidersIcon = SlidersHorizontal;
  readonly ArrowUpIcon = ArrowUp;
  readonly ArrowDownIcon = ArrowDown;
  readonly ChevronsUpDownIcon = ChevronsUpDown;
  readonly InfoIcon = Info;

  readonly SIN_CUENTA = SIN_CUENTA;

  readonly showRegistrados = signal(false);

  /** Slot cuyo movimiento registrado se está a punto de ELIMINAR (irreversible: hace deleteDoc). */
  readonly confirmingUnregisterId = signal<string | null>(null);
  /** Movimiento pendiente de confirmar borrado. */
  readonly confirmingDeleteMovId = signal<string | null>(null);

  readonly cuentaMap = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.cuentas()) map.set(c.id, c.nombre);
    return map;
  });

  /** Copia local reordenable; se resincroniza cuando cambia el input. */
  readonly orderedSlots = linkedSignal<GestoriaSlot[]>(() => this.slots());

  readonly dragFrom = signal<number | null>(null);
  readonly dragOver = signal<number | null>(null);

  readonly resumenMov = computed(() => {
    const acc = {
      totalIngresos: 0, totalEgresos: 0, suplidos: 0, honorarios: 0, gastos: 0, otros: 0,
      saldo: 0, ivaRepercutido: 0, ivaSoportado: 0,
    };
    for (const m of this.movimientos()) {
      const cuota = m.cuotaIva ?? 0;
      if (m.esEntrada) {
        acc.totalIngresos += m.importe;
        acc.ivaRepercutido += cuota;
      } else {
        acc.totalEgresos += m.importe;
        acc.ivaSoportado += cuota;
        if (m.tipo === 'suplido') acc.suplidos += m.importe;
        else if (m.tipo === 'honorario') acc.honorarios += m.importe;
        else if (m.tipo === 'gasto') acc.gastos += m.importe;
        else acc.otros += m.importe;
      }
    }
    acc.saldo = acc.totalIngresos - acc.totalEgresos;
    return acc;
  });

  // ── Desglose de egresos (popover) ──────────────────────

  /** Abierto por hover, foco o clic; se cierra con Escape o al salir del grupo. */
  readonly desgloseAbierto = signal(false);

  /** Tramos del desglose de egresos con su peso relativo, ya listos para pintar. */
  readonly desgloseEgresos = computed(() => {
    const r = this.resumenMov();
    const total = r.totalEgresos;
    if (total <= 0) return [];
    const tramos: { tipo: MovimientoTipo; etiqueta: string; importe: number }[] = [
      { tipo: 'suplido', etiqueta: 'Suplidos', importe: r.suplidos },
      { tipo: 'honorario', etiqueta: 'Honorarios', importe: r.honorarios },
      { tipo: 'gasto', etiqueta: 'Gastos', importe: r.gastos },
      { tipo: 'otro', etiqueta: 'Otros', importe: r.otros },
    ];
    return tramos
      .filter(t => t.importe > 0)
      .map(t => ({ ...t, porcentaje: (t.importe / total) * 100, color: this.getMovTipoStyle(t.tipo).color }));
  });

  onEscape(): void {
    this.desgloseAbierto.set(false);
  }

  // ── Filtros y ordenamiento de movimientos ──────────────

  readonly mostrarFiltros = signal(false);

  /** Columnas ordenables de la tabla, en el orden en que se pintan. */
  readonly columnas: readonly { campo: CampoOrden; etiqueta: string; alineaDerecha?: boolean }[] = [
    { campo: 'concepto', etiqueta: 'Concepto' },
    { campo: 'tipo', etiqueta: 'Tipo' },
    { campo: 'fecha', etiqueta: 'Fecha' },
    { campo: 'importe', etiqueta: 'Importe', alineaDerecha: true },
  ];

  readonly direcciones: readonly { valor: DireccionFiltro; etiqueta: string }[] = [
    { valor: 'todas', etiqueta: 'Todas' },
    { valor: 'entradas', etiqueta: 'Entradas' },
    { valor: 'salidas', etiqueta: 'Salidas' },
  ];

  readonly presets: readonly { valor: 'mes' | 'trimestre' | 'anio'; etiqueta: string }[] = [
    { valor: 'mes', etiqueta: 'Este mes' },
    { valor: 'trimestre', etiqueta: 'Trimestre' },
    { valor: 'anio', etiqueta: 'Este año' },
  ];

  readonly filtroTexto = signal('');
  readonly filtroTipos = signal<readonly MovimientoTipo[]>([]);
  readonly filtroDireccion = signal<DireccionFiltro>('todas');
  readonly filtroCuentas = signal<readonly string[]>([]);
  readonly filtroDesde = signal('');
  readonly filtroHasta = signal('');

  readonly orden = signal<OrdenMovimientos>(ORDEN_MOVIMIENTOS_DEFECTO);

  readonly filtro = computed<FiltroMovimientos>(() => ({
    texto: this.filtroTexto(),
    tipos: this.filtroTipos(),
    direccion: this.filtroDireccion(),
    cuentaIds: this.filtroCuentas(),
    desde: this.filtroDesde(),
    hasta: this.filtroHasta(),
  }));

  /** Lo que realmente se pinta en la tabla: filtrado y ordenado. */
  readonly movimientosVisibles = computed(() =>
    filtrarYOrdenar(this.movimientos(), this.filtro(), this.orden())
  );

  readonly hayFiltro = computed(() => hayFiltroActivo(this.filtro()));

  /** Cuántos movimientos hay por tipo, para el contador de cada chip. */
  readonly conteoPorTipo = computed(() => contarPorTipo(this.movimientos()));

  /** Tipos que aparecen de verdad en este caso: no ofrecemos chips que no filtran nada. */
  readonly tiposDisponibles = computed(() =>
    (['ingreso', 'suplido', 'honorario', 'gasto', 'otro', 'ajuste'] as const)
      .filter(t => this.conteoPorTipo().has(t))
  );

  /** true si algún movimiento del caso no tiene cuenta: solo entonces ofrecemos ese chip. */
  readonly haySinCuenta = computed(() => this.movimientos().some(m => !m.cuentaId));

  toggleTipo(tipo: MovimientoTipo): void {
    this.filtroTipos.update(actuales =>
      actuales.includes(tipo) ? actuales.filter(t => t !== tipo) : [...actuales, tipo]
    );
  }

  toggleCuenta(cuentaId: string): void {
    this.filtroCuentas.update(actuales =>
      actuales.includes(cuentaId) ? actuales.filter(c => c !== cuentaId) : [...actuales, cuentaId]
    );
  }

  /** Clic en cabecera: alterna asc/desc si ya es el campo activo, si no lo activa. */
  toggleOrden(campo: CampoOrden): void {
    this.orden.update(actual =>
      actual.campo === campo
        ? { campo, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' }
        : { campo, direccion: campo === 'fecha' || campo === 'importe' ? 'desc' : 'asc' }
    );
  }

  /** Presets de rango: mes, trimestre y año en curso. */
  aplicarPreset(preset: 'mes' | 'trimestre' | 'anio'): void {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const iso = (y: number, m: number, d: number) =>
      `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (preset === 'mes') {
      this.filtroDesde.set(iso(anio, hoy.getMonth(), 1));
      this.filtroHasta.set(iso(anio, hoy.getMonth(), new Date(anio, hoy.getMonth() + 1, 0).getDate()));
      return;
    }
    if (preset === 'trimestre') {
      const inicio = Math.floor(hoy.getMonth() / 3) * 3;
      this.filtroDesde.set(iso(anio, inicio, 1));
      this.filtroHasta.set(iso(anio, inicio + 2, new Date(anio, inicio + 3, 0).getDate()));
      return;
    }
    this.filtroDesde.set(iso(anio, 0, 1));
    this.filtroHasta.set(iso(anio, 11, 31));
  }

  limpiarFiltros(): void {
    this.filtroTexto.set(FILTRO_MOVIMIENTOS_VACIO.texto);
    this.filtroTipos.set(FILTRO_MOVIMIENTOS_VACIO.tipos);
    this.filtroDireccion.set(FILTRO_MOVIMIENTOS_VACIO.direccion);
    this.filtroCuentas.set(FILTRO_MOVIMIENTOS_VACIO.cuentaIds);
    this.filtroDesde.set(FILTRO_MOVIMIENTOS_VACIO.desde);
    this.filtroHasta.set(FILTRO_MOVIMIENTOS_VACIO.hasta);
  }

  /** Filtra la tabla por un solo tipo desde el desglose de egresos. */
  filtrarPorTipo(tipo: MovimientoTipo): void {
    this.filtroTipos.set([tipo]);
    this.filtroDireccion.set('salidas');
    this.mostrarFiltros.set(true);
    this.desgloseAbierto.set(false);
  }

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

  // ── Confirmaciones de borrado ──────────────────────────

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

  requestDeleteMov(movId: string): void {
    this.confirmingDeleteMovId.set(movId);
  }

  cancelDeleteMov(): void {
    this.confirmingDeleteMovId.set(null);
  }

  confirmDeleteMov(movId: string): void {
    this.deleteMov.emit(movId);
    this.confirmingDeleteMovId.set(null);
  }

  getMovTipoStyle(tipo: MovimientoTipo): { background: string; color: string } {
    const mix = (v: string) => `color-mix(in srgb,${v} 12%,transparent)`;
    const map: Record<MovimientoTipo, { background: string; color: string }> = {
      ingreso:   { background: mix('var(--success)'), color: 'var(--success)' },
      suplido:   { background: mix('var(--warning)'), color: 'var(--warning)' },
      honorario: { background: mix('var(--accent-ia)'), color: 'var(--accent-ia)' },
      gasto:     { background: mix('var(--danger)'),  color: 'var(--danger)' },
      otro:      { background: 'var(--surface-2)',     color: 'var(--text-muted)' },
      ajuste:    { background: 'var(--surface-2)',     color: 'var(--text-muted)' },
    };
    return map[tipo];
  }
}
