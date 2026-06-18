import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, Wallet, TrendingUp, TrendingDown, Landmark,
  CheckCircle2, AlertTriangle, Save, Scale, TrendingUpDown,
  Building2, Plus, Settings, History, ArrowDownLeft,
} from 'lucide-angular';
import {
  Firestore, doc, onSnapshot, type Unsubscribe,
} from '@angular/fire/firestore';
import { CasosService } from '../../core/services/casos.service';
import { CompanyService } from '../../core/services/company.service';
import { GestoriaService } from '../../core/services/gestoria.service';
import { CuentasService } from '../../core/services/cuentas.service';
import { Caso, TesoreriaResumen } from '../../interfaces';
import { TesoresriaCasoDrawerComponent } from './components/tesoreria-caso-drawer/tesoreria-caso-drawer';
import { RevisionMovimientosComponent } from './components/revision-movimientos/revision-movimientos';
import { CuentasDrawerComponent } from './components/cuentas-drawer/cuentas-drawer';
import { RetiroDrawerComponent } from './components/retiro-drawer/retiro-drawer';

const COTEJO_TOLERANCIA = 0.01;

@Component({
  selector: 'app-tesoreria',
  imports: [
    LucideAngularModule, DecimalPipe,
    TesoresriaCasoDrawerComponent, RevisionMovimientosComponent,
    CuentasDrawerComponent, RetiroDrawerComponent,
  ],
  templateUrl: './tesoreria.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TesoreriaComponent implements OnInit, OnDestroy {
  private readonly casosService = inject(CasosService);
  private readonly companyService = inject(CompanyService);
  private readonly gestoriaService = inject(GestoriaService);
  private readonly cuentasService = inject(CuentasService);
  private readonly firestore = inject(Firestore);

  readonly WalletIcon = Wallet;
  readonly TrendingUpIcon = TrendingUp;
  readonly TrendingDownIcon = TrendingDown;
  readonly LandmarkIcon = Landmark;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly SaveIcon = Save;
  readonly ScaleIcon = Scale;
  readonly TrendingUpDownIcon = TrendingUpDown;
  readonly Building2Icon = Building2;
  readonly PlusIcon = Plus;
  readonly SettingsIcon = Settings;
  readonly HistoryIcon = History;
  readonly ArrowDownLeftIcon = ArrowDownLeft;

  readonly casos = this.casosService.casos;
  readonly selectedCaso = signal<Caso | null>(null);
  readonly loading = this.casosService.loading;
  readonly savingSaldo = signal(false);

  readonly cuentas = this.cuentasService.cuentas;
  readonly retiros = this.gestoriaService.retiros;

  readonly showCuentasDrawer = signal(false);
  readonly showRetiroDrawer = signal(false);

  /** Resumen histórico de casos cerrados (desde tesoreria_meta/resumen). */
  readonly resumenHistorico = signal<TesoreriaResumen | null>(null);

  private resumenHistoricoUnsub: Unsubscribe | null = null;

  readonly saldoBancarioInput = signal('');

  /** Contabilidad agregada de todos los casos activos. */
  readonly balanceGeneral = computed(() => {
    return this.casos().reduce(
      (acc, c) => {
        const r = c.resumenFinanciero;
        acc.totalIngresos += r?.totalIngresos ?? 0;
        acc.totalSuplidos += r?.totalSuplidos ?? 0;
        acc.totalHonorarios += r?.totalHonorarios ?? 0;
        acc.saldo += r?.saldo ?? 0;
        return acc;
      },
      { totalIngresos: 0, totalSuplidos: 0, totalHonorarios: 0, saldo: 0 }
    );
  });

  /** Balance combinado: activos + cerrados históricos + retiros. */
  readonly balanceCombinado = computed(() => {
    const activo = this.balanceGeneral();
    const hist = this.resumenHistorico();
    const totalRetiros = this.retiros().reduce((acc, r) => acc + r.importe, 0);
    return {
      totalIngresos: activo.totalIngresos + (hist?.totalIngresosCerrados ?? 0),
      totalSuplidos: activo.totalSuplidos + (hist?.totalSuplidosCerrados ?? 0),
      totalHonorarios: activo.totalHonorarios + (hist?.totalHonorariosCerrados ?? 0),
      saldo: activo.saldo + (hist?.saldoCerrados ?? 0) - totalRetiros,
      casosHistoricos: hist?.casosCount ?? 0,
    };
  });

  readonly casosContables = computed(() =>
    this.casos()
      .filter(c => {
        const r = c.resumenFinanciero;
        return (r?.totalIngresos || r?.totalSuplidos || r?.totalHonorarios);
      })
      .sort((a, b) => (b.resumenFinanciero?.saldo ?? 0) - (a.resumenFinanciero?.saldo ?? 0))
  );

  readonly saldoBancario = computed(() => this.companyService.activeCompany()?.saldoBancario ?? null);
  readonly saldoBancarioFecha = computed(() => this.companyService.activeCompany()?.saldoBancarioFecha ?? null);

  /** Saldo aprobado de los movimientos de casos activos. */
  readonly saldoAprobado = computed(() =>
    this.gestoriaService.todosMovimientos()
      .filter(m => m.aprobado === true)
      .reduce((acc, m) => acc + (m.esEntrada ? m.importe : -m.importe), 0)
  );

  /** Cotejo legacy (un solo saldo bancario en company) — solo se usa si no hay cuentas. */
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

  /** Cotejo por cuenta bancaria. */
  readonly cotejosPorCuenta = computed(() => {
    const movimientos = this.gestoriaService.todosMovimientos().filter(m => m.aprobado === true);
    const retiros = this.retiros();

    return this.cuentas().map(cuenta => {
      const movsCuenta = movimientos.filter(m => m.cuentaId === cuenta.id);
      const retirosCuenta = retiros.filter(r => r.cuentaId === cuenta.id);

      const sistema =
        movsCuenta.reduce((acc, m) => acc + (m.esEntrada ? m.importe : -m.importe), 0) -
        retirosCuenta.reduce((acc, r) => acc + r.importe, 0);

      const banco = cuenta.saldoBancario ?? null;
      const diferencia = banco !== null ? banco - sistema : null;
      return {
        cuenta,
        sistema,
        banco,
        diferencia,
        conciliado: diferencia !== null && Math.abs(diferencia) < COTEJO_TOLERANCIA,
      };
    });
  });

  /** true si todas las cuentas con saldo registrado están conciliadas. */
  readonly todoConciliado = computed(() => {
    const cotejos = this.cotejosPorCuenta();
    if (cotejos.length === 0) return this.cotejo()?.conciliado ?? false;
    return cotejos.filter(c => c.banco !== null).every(c => c.conciliado);
  });

  readonly totalEgresos = computed(() =>
    this.gestoriaService.todosMovimientos()
      .filter(m => !m.esEntrada)
      .reduce((acc, m) => acc + m.importe, 0)
  );

  private readonly movimientosPendientes = computed(() =>
    this.gestoriaService.todosMovimientos().filter(m => m.aprobado == null)
  );

  readonly proyeccionBancaria = computed(() => {
    const aprobado = this.saldoAprobado();
    const impacto = this.movimientosPendientes().reduce(
      (acc, m) => acc + (m.esEntrada ? m.importe : -m.importe),
      0
    );
    return { aprobado, impacto, proyeccion: aprobado + impacto };
  });

  readonly resumenPorCaso = computed(() => {
    const map = new Map<string, { ingresos: number; egresos: number; saldoAprobado: number; saldoProyectado: number }>();

    for (const m of this.gestoriaService.todosMovimientos()) {
      const entry = map.get(m.casoId) ?? { ingresos: 0, egresos: 0, saldoAprobado: 0, saldoProyectado: 0 };

      if (m.esEntrada) entry.ingresos += m.importe;
      else entry.egresos += m.importe;

      if (m.aprobado === true) {
        entry.saldoAprobado += m.esEntrada ? m.importe : -m.importe;
      } else if (m.aprobado == null) {
        entry.saldoProyectado += m.esEntrada ? m.importe : -m.importe;
      }

      map.set(m.casoId, entry);
    }

    for (const entry of map.values()) {
      entry.saldoProyectado += entry.saldoAprobado;
    }

    return map;
  });

  async ngOnInit(): Promise<void> {
    await this.casosService.loadCasos();
    this.gestoriaService.loadTodosMovimientos();
    this.gestoriaService.loadRetiros();
    this.cuentasService.loadCuentas();
    this.subscribeResumenHistorico();
    const actual = this.saldoBancario();
    if (actual !== null) this.saldoBancarioInput.set(String(actual));
  }

  ngOnDestroy(): void {
    this.gestoriaService.stopTodosMovimientos();
    this.gestoriaService.stopRetiros();
    this.cuentasService.stopCuentas();
    this.resumenHistoricoUnsub?.();
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
    await this.cuentasService.actualizarSaldo(cuentaId, saldo);
  }

  async guardarSaldoBancario(): Promise<void> {
    const company = this.companyService.activeCompany();
    const raw = this.saldoBancarioInput().trim();
    if (!company || raw === '') return;
    const saldo = parseFloat(raw.replace(',', '.'));
    if (Number.isNaN(saldo)) return;

    this.savingSaldo.set(true);
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      await this.companyService.updateSaldoBancario(company.id, saldo, hoy);
    } finally {
      this.savingSaldo.set(false);
    }
  }
}
