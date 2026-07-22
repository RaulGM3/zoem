import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import {
  LucideAngularModule, Wallet, Landmark, CheckCircle2, AlertTriangle, Save, Scale,
  Building2, Settings, History, Lock, Plus,
} from 'lucide-angular';
import {
  Firestore, doc, onSnapshot, type Unsubscribe,
} from '@angular/fire/firestore';
import { CasosService } from '../../core/services/casos.service';
import { CompanyService } from '../../core/services/company.service';
import { PermissionService } from '../../core/services/permission.service';
import { UsersService } from '../../core/services/users';
import { GestoriaService } from '../../core/services/gestoria.service';
import { CuentasService } from '../../core/services/cuentas.service';
import { CierreCajaService } from '../../core/services/cierre-caja.service';
import { ConciliacionService } from '../../core/services/conciliacion.service';
import { ToastService } from '../../core/services/toast.service';
import { parseExtractoCsv, autoMatch } from '../../core/conciliacion/conciliacion';
import { saldoAprobado, balancePorCuenta } from '../../core/tesoreria/saldos';
import { Caso, CierreCuenta, TesoreriaResumen } from '../../interfaces';
import type { MovimientoTipo } from '../../interfaces';
import { TesoresriaCasoDrawerComponent } from './components/tesoreria-caso-drawer/tesoreria-caso-drawer';
import { RevisionMovimientosComponent } from './components/revision-movimientos/revision-movimientos';
import { CuentasDrawerComponent } from './components/cuentas-drawer/cuentas-drawer';
import { TesoreriaResumenTabComponent } from './components/resumen-tab/resumen-tab';
import { TesoreriaCasosTabComponent } from './components/casos-tab/casos-tab';
import { CierreCajaModalComponent } from './components/cierre-caja-modal/cierre-caja-modal';
import { ConciliacionTabComponent } from './components/conciliacion-tab/conciliacion-tab';
import { ReportesTabComponent } from './components/reportes-tab/reportes-tab';
import { MovimientoGeneralDrawerComponent } from './components/movimiento-general-drawer/movimiento-general-drawer';
import { MovimientoGestoria } from '../../interfaces';

const COTEJO_TOLERANCIA = 0.01;

export type TabTesoreria = 'resumen' | 'movimientos' | 'conciliacion' | 'reportes' | 'casos';

/** Redondea a 2 decimales para evitar drift de coma flotante en acumulaciones de dinero. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Fecha local (no UTC) en formato YYYY-MM-DD — evita el desfase de `toISOString().slice(0, 10)`. */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Record exhaustivo sobre el union completo de MovimientoTipo: si se añade un
// tipo nuevo (como pasó con 'ajuste'), TypeScript obliga a declararlo aquí,
// así el reporte no puede volver a crashear por un tipo no contemplado.
const TIPOS_REPORTE_EXHAUSTIVO: Record<MovimientoTipo, true> = {
  ingreso: true, suplido: true, honorario: true, gasto: true, otro: true, ajuste: true,
};
const TIPOS_REPORTE: readonly MovimientoTipo[] = Object.keys(TIPOS_REPORTE_EXHAUSTIVO) as MovimientoTipo[];

@Component({
  selector: 'app-tesoreria',
  imports: [
    LucideAngularModule,
    TesoresriaCasoDrawerComponent, RevisionMovimientosComponent,
    CuentasDrawerComponent,
    TesoreriaResumenTabComponent, TesoreriaCasosTabComponent,
    CierreCajaModalComponent, ConciliacionTabComponent, ReportesTabComponent,
    MovimientoGeneralDrawerComponent,
  ],
  templateUrl: './tesoreria.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TesoreriaComponent implements OnInit, OnDestroy {
  private readonly casosService = inject(CasosService);
  private readonly companyService = inject(CompanyService);
  private readonly gestoriaService = inject(GestoriaService);
  private readonly cuentasService = inject(CuentasService);
  private readonly cierreCajaService = inject(CierreCajaService);
  private readonly conciliacionService = inject(ConciliacionService);
  private readonly toast = inject(ToastService);
  private readonly firestore = inject(Firestore);
  private readonly usersService = inject(UsersService);
  readonly perm = inject(PermissionService);

  readonly importandoExtracto = signal(false);

  readonly WalletIcon = Wallet;
  readonly LandmarkIcon = Landmark;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly SaveIcon = Save;
  readonly ScaleIcon = Scale;
  readonly Building2Icon = Building2;
  readonly SettingsIcon = Settings;
  readonly HistoryIcon = History;
  readonly LockIcon = Lock;
  readonly PlusIcon = Plus;

  readonly activeTab = signal<TabTesoreria>('resumen');
  readonly casos = this.casosService.casos;
  readonly selectedCaso = signal<Caso | null>(null);
  readonly loading = this.casosService.loading;
  readonly savingSaldo = signal(false);

  readonly cuentas = this.cuentasService.cuentas;

  readonly showCuentasDrawer = signal(false);
  readonly showCierreModal = signal(false);
  readonly savingCierre = signal(false);
  readonly showMovimientoGeneralDrawer = signal(false);
  readonly editandoMovimientoGeneral = signal<MovimientoGestoria | null>(null);

  readonly cierres = this.cierreCajaService.cierres;

  readonly lineasExtracto = this.conciliacionService.lineas;

  /** IDs de movimientos ya casados contra una línea de extracto. */
  private readonly movimientosCasados = computed(() => {
    const set = new Set<string>();
    for (const l of this.lineasExtracto()) {
      if (l.estado === 'casado' && l.movimientoId) set.add(l.movimientoId);
    }
    return set;
  });

  /** Saldo real por cuenta derivado del extracto (última línea con saldo). */
  private readonly saldoExtractoPorCuenta = computed(() => {
    const map = new Map<string, number>();
    // lineasExtracto viene ordenado por fecha desc; la primera con saldo de cada cuenta es la más reciente.
    for (const l of this.lineasExtracto()) {
      if (l.saldoPosterior != null && !map.has(l.cuentaId)) map.set(l.cuentaId, l.saldoPosterior);
    }
    return map;
  });

  /** Movimientos enriquecidos para el match manual del tab de conciliación. */
  readonly movimientosConciliables = computed(() => {
    const nombres = this.casoNombresMap();
    const casados = this.movimientosCasados();
    return this.gestoriaService.todosMovimientos().map(m => ({
      id: m.id,
      cuentaId: m.cuentaId,
      fecha: m.fecha,
      concepto: m.concepto,
      importe: m.importe,
      esEntrada: m.esEntrada,
      casoNombre: m.casoId ? (nombres.get(m.casoId) ?? m.casoId) : 'General',
      conciliado: casados.has(m.id),
    }));
  });

  readonly cierrePreview = computed((): CierreCuenta[] =>
    this.cotejosPorCuenta().map(c => ({
      cuentaId: c.cuenta.id,
      nombre: c.cuenta.nombre,
      tipo: c.cuenta.tipo,
      ingresos: c.ingresos,
      egresos: c.egresos,
      sistema: c.sistema,
      aprobado: c.proyeccion,
      saldoReal: c.banco,
      diferencia: c.diferencia,
      conciliado: c.conciliado,
    }))
  );

  readonly resumenHistorico = signal<TesoreriaResumen | null>(null);
  private resumenHistoricoUnsub: Unsubscribe | null = null;

  readonly saldoBancarioInput = signal('');

  // ── Casos (Bloque "Casos") ──────────────────────────────────────────────
  // Única fuente de verdad para el tab de casos: `resumenPorCaso` (más abajo)
  // ya separa honorarios de ingresos igual que `casos.service.ts#recalcularResumen`,
  // y filtra por `casoId` real (excluye movimientos_generales sin caso). Tanto
  // las filas como el pie de tabla derivan de ese mismo mapa para que
  // Total Ingresos − Total Egresos siempre cuadre con lo mostrado por caso.
  readonly casosContables = computed(() => {
    const resumen = this.resumenPorCaso();
    return this.casos()
      .filter(c => {
        const r = resumen.get(c.id);
        return !!r && (r.ingresos || r.honorarios || r.egresos);
      })
      .sort((a, b) => {
        const ra = resumen.get(a.id);
        const rb = resumen.get(b.id);
        const saldoA = (ra?.ingresos ?? 0) + (ra?.honorarios ?? 0) - (ra?.egresos ?? 0);
        const saldoB = (rb?.ingresos ?? 0) + (rb?.honorarios ?? 0) - (rb?.egresos ?? 0);
        return saldoB - saldoA;
      });
  });

  /** Totales del pie de tabla del tab "Casos": suma de las mismas filas visibles. */
  readonly casosFooterTotales = computed(() => {
    const resumen = this.resumenPorCaso();
    return this.casosContables().reduce(
      (acc, c) => {
        const r = resumen.get(c.id);
        if (!r) return acc;
        acc.ingresos = round2(acc.ingresos + r.ingresos);
        acc.honorarios = round2(acc.honorarios + r.honorarios);
        acc.egresos = round2(acc.egresos + r.egresos);
        acc.saldoAprobado = round2(acc.saldoAprobado + r.saldoAprobado);
        acc.saldoProyectado = round2(acc.saldoProyectado + r.saldoProyectado);
        return acc;
      },
      { ingresos: 0, honorarios: 0, egresos: 0, saldoAprobado: 0, saldoProyectado: 0 },
    );
  });

  readonly saldoBancario = computed(() => this.companyService.activeCompany()?.saldoBancario ?? null);
  readonly saldoBancarioFecha = computed(() => this.companyService.activeCompany()?.saldoBancarioFecha ?? null);

  // Saldo aprobado global (todas las cuentas, todos los movimientos) — usado
  // sólo para el cotejo bancario de la pestaña "Resumen" cuando no hay cuentas
  // configuradas. No confundir con los totales del tab "Casos" (ver arriba).
  readonly saldoAprobado = computed(() =>
    saldoAprobado(this.gestoriaService.todosMovimientos())
  );

  readonly cotejo = computed(() => {
    if (this.cuentas().length > 0) return null;
    const banco = this.saldoBancario();
    if (banco === null) return null;
    const sistema = this.saldoAprobado();
    const diferencia = banco - sistema;
    return {
      banco,
      sistema,
      diferencia,
      conciliado: Math.abs(diferencia) < COTEJO_TOLERANCIA,
    };
  });

  // Preferimos el saldo real del extracto importado; el tecleado a mano es el respaldo.
  readonly cotejosPorCuenta = computed(() =>
    balancePorCuenta(
      this.cuentas(),
      this.gestoriaService.todosMovimientos(),
      this.saldoExtractoPorCuenta(),
    )
  );

  readonly movimientosPendientes = computed(() =>
    this.gestoriaService.todosMovimientos().filter(m => m.aprobado == null).length
  );

  readonly todoConciliado = computed(() => {
    const cotejos = this.cotejosPorCuenta();
    if (cotejos.length === 0) return this.cotejo()?.conciliado ?? false;
    return cotejos.filter(c => c.banco !== null).every(c => c.conciliado);
  });

  private readonly casoNombresMap = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.casos()) map.set(c.id, c.titulo);
    return map;
  });

  readonly movimientosPorCuenta = computed(() => {
    const nombres = this.casoNombresMap();
    const map = new Map<string, Array<ReturnType<typeof this.gestoriaService.todosMovimientos>[number] & { casoNombre: string }>>();
    for (const m of this.gestoriaService.todosMovimientos()) {
      if (!m.cuentaId) continue;
      const casoNombre = m.casoId ? (nombres.get(m.casoId) ?? m.casoId) : 'General';
      const enriched = { ...m, casoNombre };
      if (!map.has(m.cuentaId)) map.set(m.cuentaId, []);
      map.get(m.cuentaId)!.push(enriched);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.fecha.localeCompare(a.fecha));
    }
    return map;
  });

  readonly resumenPorCaso = computed(() => {
    const map = new Map<string, { ingresos: number; honorarios: number; egresos: number; saldoAprobado: number; saldoProyectado: number }>();

    for (const m of this.gestoriaService.todosMovimientos()) {
      const key = m.casoId ?? '__general__';
      const entry = map.get(key) ?? { ingresos: 0, honorarios: 0, egresos: 0, saldoAprobado: 0, saldoProyectado: 0 };

      if (m.esEntrada) {
        // Honorarios cobrados van a `honorarios`, no a `ingresos` — igual que
        // casos.service.ts#recalcularResumen, para que fila y pie de tabla cuadren.
        if (m.tipo === 'honorario') entry.honorarios = round2(entry.honorarios + m.importe);
        else entry.ingresos = round2(entry.ingresos + m.importe);
      } else {
        entry.egresos = round2(entry.egresos + m.importe);
      }

      if (m.aprobado === true) {
        entry.saldoAprobado = round2(entry.saldoAprobado + (m.esEntrada ? m.importe : -m.importe));
      } else if (m.aprobado == null) {
        entry.saldoProyectado = round2(entry.saldoProyectado + (m.esEntrada ? m.importe : -m.importe));
      }

      map.set(key, entry);
    }

    for (const entry of map.values()) {
      entry.saldoProyectado = round2(entry.saldoProyectado + entry.saldoAprobado);
    }

    return map;
  });

  // ── Reportes (Bloque 3) ────────────────────────────────────────────────
  readonly rangoDesde = signal('');
  readonly rangoHasta = signal('');

  readonly movimientosEnRango = computed(() => {
    const desde = this.rangoDesde();
    const hasta = this.rangoHasta();
    return this.gestoriaService.todosMovimientos().filter(m => {
      if (desde && m.fecha < desde) return false;
      if (hasta && m.fecha > hasta) return false;
      return true;
    });
  });

  readonly reporte = computed(() => {
    const porTipo = new Map<MovimientoTipo, { importe: number; base: number; cuota: number; count: number }>();
    for (const t of TIPOS_REPORTE) porTipo.set(t, { importe: 0, base: 0, cuota: 0, count: 0 });

    let ingresos = 0, egresos = 0, ivaRepercutido = 0, ivaSoportado = 0;
    for (const m of this.movimientosEnRango()) {
      const cuota = m.cuotaIva ?? 0;
      const base = m.baseImponible ?? m.importe;
      // porTipo cubre todo el union MovimientoTipo (ver TIPOS_REPORTE_EXHAUSTIVO);
      // el fallback sólo protege ante datos legacy con un `tipo` inválido en Firestore.
      const t = porTipo.get(m.tipo) ?? { importe: 0, base: 0, cuota: 0, count: 0 };
      t.importe = round2(t.importe + m.importe); t.base = round2(t.base + base); t.cuota = round2(t.cuota + cuota); t.count++;
      porTipo.set(m.tipo, t);
      if (m.esEntrada) { ingresos = round2(ingresos + m.importe); ivaRepercutido = round2(ivaRepercutido + cuota); }
      else { egresos = round2(egresos + m.importe); ivaSoportado = round2(ivaSoportado + cuota); }
    }

    return {
      porTipo: TIPOS_REPORTE.map(t => ({ tipo: t, ...(porTipo.get(t) ?? { importe: 0, base: 0, cuota: 0, count: 0 }) })),
      ingresos, egresos, saldo: round2(ingresos - egresos),
      ivaRepercutido, ivaSoportado, liquidacionIva: round2(ivaRepercutido - ivaSoportado),
      totalMovimientos: this.movimientosEnRango().length,
    };
  });

  exportarCsv(): void {
    const nombresCaso = this.casoNombresMap();
    const nombresCuenta = new Map(this.cuentas().map(c => [c.id, c.nombre] as const));
    const escapar = (v: string | number): string => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cabecera = ['Fecha', 'Caso', 'Tipo', 'Concepto', 'Cuenta', 'Direccion', 'Base', 'IVA', 'Importe', 'Aprobado'];
    const filas = this.movimientosEnRango().map(m => [
      m.fecha,
      m.casoId ? (nombresCaso.get(m.casoId) ?? m.casoId) : 'General',
      m.tipo,
      m.concepto,
      m.cuentaId ? (nombresCuenta.get(m.cuentaId) ?? '') : '',
      m.esEntrada ? 'Entrada' : 'Salida',
      (m.baseImponible ?? m.importe).toFixed(2),
      (m.cuotaIva ?? 0).toFixed(2),
      m.importe.toFixed(2),
      m.aprobado === true ? 'Si' : 'No',
    ].map(escapar).join(';'));

    const csv = [cabecera.join(';'), ...filas].join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tesoreria-${this.rangoDesde() || 'inicio'}_${this.rangoHasta() || 'hoy'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async ngOnInit(): Promise<void> {
    if (this.usersService.members().length === 0) this.usersService.loadMembers();
    await this.casosService.loadCasos();
    this.gestoriaService.loadTodosMovimientos();
    this.cuentasService.loadCuentas();
    this.cierreCajaService.loadCierres();
    this.conciliacionService.loadLineas();
    this.subscribeResumenHistorico();
    const actual = this.saldoBancario();
    if (actual !== null) this.saldoBancarioInput.set(String(actual));
  }

  ngOnDestroy(): void {
    this.gestoriaService.stopTodosMovimientos();
    this.cuentasService.stopCuentas();
    this.cierreCajaService.stopCierres();
    this.conciliacionService.stopLineas();
    this.resumenHistoricoUnsub?.();
  }

  async onImportarCsv(payload: { cuentaId: string; texto: string }): Promise<void> {
    const { lineas, errores } = parseExtractoCsv(payload.texto);
    if (lineas.length === 0) {
      alert(errores[0] ?? 'No se pudieron leer líneas del archivo.');
      return;
    }
    this.importandoExtracto.set(true);
    try {
      await this.toast.run(() => this.conciliacionService.importarExtracto(payload.cuentaId, lineas), {
        successMessage: `Importadas ${lineas.length} líneas${errores.length > 0 ? ` (${errores.length} omitidas por datos inválidos)` : ''}`,
        errorTitle: 'No se pudo importar el extracto',
      });
    } finally {
      this.importandoExtracto.set(false);
    }
  }

  async onAutoConciliar(cuentaId: string): Promise<void> {
    const lineasPendientes = this.lineasExtracto()
      .filter(l => l.cuentaId === cuentaId && l.estado === 'pendiente');
    if (lineasPendientes.length === 0) return;

    const movimientos = this.gestoriaService.todosMovimientos()
      .filter(m => m.cuentaId === cuentaId && !this.movimientosCasados().has(m.id))
      .map(m => ({ id: m.id, fecha: m.fecha, importe: m.importe, esEntrada: m.esEntrada }));

    const matches = autoMatch(
      lineasPendientes.map(l => ({ fecha: l.fecha, concepto: l.concepto, importe: l.importe })),
      movimientos,
    );
    if (matches.length === 0) return;
    await this.toast.run(
      () => this.conciliacionService.aplicarMatches(cuentaId, lineasPendientes.map(l => l.id), matches),
      { successMessage: `${matches.length} línea(s) conciliada(s)`, errorTitle: 'No se pudo autoconciliar' }
    );
  }

  async onCasar(e: { cuentaId: string; lineaId: string; movimientoId: string }): Promise<void> {
    if (!e.movimientoId) return;
    await this.toast.run(() => this.conciliacionService.casarLinea(e.cuentaId, e.lineaId, e.movimientoId), {
      errorTitle: 'No se pudo conciliar la línea',
    });
  }

  async onDesconciliar(e: { cuentaId: string; lineaId: string }): Promise<void> {
    await this.toast.run(() => this.conciliacionService.desconciliar(e.cuentaId, e.lineaId), {
      errorTitle: 'No se pudo desconciliar',
    });
  }

  async onIgnorarLinea(e: { cuentaId: string; lineaId: string }): Promise<void> {
    await this.toast.run(() => this.conciliacionService.ignorarLinea(e.cuentaId, e.lineaId), {
      errorTitle: 'No se pudo ignorar la línea',
    });
  }

  async realizarCierre(notas: string): Promise<void> {
    this.savingCierre.set(true);
    try {
      await this.toast.run(() => this.cierreCajaService.crearCierre(this.cierrePreview(), notas), {
        successMessage: 'Cierre de caja registrado',
        errorTitle: 'No se pudo registrar el cierre',
        onSuccess: () => this.showCierreModal.set(false),
      });
    } finally {
      this.savingCierre.set(false);
    }
  }

  private subscribeResumenHistorico(): void {
    const companyId = this.companyService.activeCompany()?.id;
    if (!companyId) return;
    const ref = doc(this.firestore, 'companies', companyId, 'tesoreria_meta', 'resumen');
    this.resumenHistoricoUnsub = onSnapshot(ref, snap => {
      this.resumenHistorico.set(snap.exists() ? (snap.data() as TesoreriaResumen) : null);
    });
  }

  async actualizarSaldoCuenta(cuentaId: string, valor: string): Promise<void> {
    const saldo = parseFloat(valor.replace(',', '.'));
    if (Number.isNaN(saldo)) return;
    await this.toast.run(() => this.cuentasService.actualizarSaldo(cuentaId, saldo), {
      errorTitle: 'No se pudo actualizar el saldo',
    });
  }

  async guardarSaldoBancario(valor: string): Promise<void> {
    const company = this.companyService.activeCompany();
    const raw = valor.trim();
    if (!company || raw === '') return;
    const saldo = parseFloat(raw.replace(',', '.'));
    if (Number.isNaN(saldo)) return;

    this.savingSaldo.set(true);
    try {
      const hoy = localDateStr(new Date());
      await this.toast.run(() => this.companyService.updateSaldoBancario(company.id, saldo, hoy), {
        successMessage: 'Saldo bancario guardado',
        errorTitle: 'No se pudo guardar el saldo bancario',
      });
    } finally {
      this.savingSaldo.set(false);
    }
  }
}
