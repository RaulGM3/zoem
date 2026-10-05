import { Component, ChangeDetectionStrategy, input, output, computed, signal, inject } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import {
  LucideAngularModule, Plus, Trash2, X, Check, Pencil, Search, SlidersHorizontal,
  ArrowUp, ArrowDown, ChevronsUpDown,
} from 'lucide-angular';
import type { CuentaBancaria, MovimientoGestoria, MovimientoTipo } from '../../../../interfaces';
import {
  FILTRO_MOVIMIENTOS_VACIO, ORDEN_MOVIMIENTOS_DEFECTO, SIN_CUENTA,
  filtrarYOrdenar, hayFiltroActivo, contarPorTipo,
  type CampoOrden, type DireccionFiltro, type FiltroMovimientos, type OrdenMovimientos,
} from '../../../../core/tesoreria/filtro-movimientos';
import { movTipoStyle } from '../mov-tipo-style';
import { BreakpointService } from '../../../../core/services/breakpoint.service';
import { ActionMenuComponent, type MenuAction } from '../../../../shared/components/action-menu/action-menu';

/** Tabla de movimientos de gestoría de un caso, con búsqueda, filtros y ordenación. */
@Component({
  selector: 'app-caso-movimientos',
  host: { class: 'block' },
  imports: [LucideAngularModule, DecimalPipe, TitleCasePipe, ActionMenuComponent],
  templateUrl: './caso-movimientos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoMovimientosComponent {
  readonly movimientos = input.required<MovimientoGestoria[]>();
  readonly loading = input(false);
  readonly miembros = input<ReadonlyMap<string, string>>(new Map());
  readonly cuentas = input<CuentaBancaria[]>([]);
  readonly canEdit = input(true);
  readonly canDelete = input(true);

  readonly addMov = output<void>();
  readonly deleteMov = output<string>();
  readonly editMov = output<MovimientoGestoria>();

  protected readonly bp = inject(BreakpointService);

  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;
  readonly CheckIcon = Check;
  readonly PencilIcon = Pencil;
  readonly SearchIcon = Search;
  readonly SlidersIcon = SlidersHorizontal;
  readonly ArrowUpIcon = ArrowUp;
  readonly ArrowDownIcon = ArrowDown;
  readonly ChevronsUpDownIcon = ChevronsUpDown;

  readonly SIN_CUENTA = SIN_CUENTA;

  /** Movimiento pendiente de confirmar borrado. */
  readonly confirmingDeleteMovId = signal<string | null>(null);

  readonly cuentaMap = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.cuentas()) map.set(c.id, c.nombre);
    return map;
  });

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

  /** Filtra la tabla por un solo tipo de salida (lo usa el desglose de egresos del resumen). */
  filtrarPorTipo(tipo: MovimientoTipo): void {
    this.filtroTipos.set([tipo]);
    this.filtroDireccion.set('salidas');
    this.mostrarFiltros.set(true);
  }

  /** Opciones del selector de orden móvil (equivale a pulsar las cabeceras de la tabla). */
  readonly opcionesOrden: readonly { valor: string; etiqueta: string }[] = [
    { valor: 'fecha:desc', etiqueta: 'Fecha (más reciente)' },
    { valor: 'fecha:asc', etiqueta: 'Fecha (más antigua)' },
    { valor: 'importe:desc', etiqueta: 'Importe (mayor)' },
    { valor: 'importe:asc', etiqueta: 'Importe (menor)' },
    { valor: 'concepto:asc', etiqueta: 'Concepto (A-Z)' },
    { valor: 'concepto:desc', etiqueta: 'Concepto (Z-A)' },
    { valor: 'tipo:asc', etiqueta: 'Tipo (A-Z)' },
    { valor: 'tipo:desc', etiqueta: 'Tipo (Z-A)' },
  ];

  /** Valor `campo:direccion` del orden actual. */
  readonly valorOrden = computed(() => `${this.orden().campo}:${this.orden().direccion}`);

  /** Aplica un valor del selector de orden; ignora los que no están en las opciones. */
  establecerOrden(valor: string): void {
    if (!this.opcionesOrden.some(o => o.valor === valor)) return;
    const [campo, direccion] = valor.split(':') as [CampoOrden, OrdenMovimientos['direccion']];
    this.orden.set({ campo, direccion });
  }

  /** Acciones del menú móvil (⋯) de cada tarjeta, según permisos. */
  readonly acciones = computed<MenuAction[]>(() => {
    const out: MenuAction[] = [];
    if (this.canEdit()) out.push({ id: 'edit', label: 'Editar', icon: Pencil });
    if (this.canDelete()) out.push({ id: 'delete', label: 'Eliminar', icon: Trash2, danger: true });
    return out;
  });

  /** Ejecuta una acción del menú móvil: mismos efectos que los iconos de la tabla. */
  ejecutar(id: string, mov: MovimientoGestoria): void {
    if (id === 'edit') this.editMov.emit(mov);
    else if (id === 'delete') this.requestDeleteMov(mov.id);
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
    return movTipoStyle(tipo);
  }
}
