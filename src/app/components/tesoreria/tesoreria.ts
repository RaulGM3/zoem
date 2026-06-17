import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, Wallet, TrendingUp, TrendingDown, Landmark,
  CheckCircle2, AlertTriangle, Save, Scale, TrendingUpDown,
} from 'lucide-angular';
import { CasosService } from '../../core/services/casos.service';
import { CompanyService } from '../../core/services/company.service';
import { GestoriaService } from '../../core/services/gestoria.service';
import { Caso } from '../../interfaces';
import { TesoresriaCasoDrawerComponent } from './components/tesoreria-caso-drawer/tesoreria-caso-drawer';
import { RevisionMovimientosComponent } from './components/revision-movimientos/revision-movimientos';

/** Umbral (€) por debajo del cual consideramos el cotejo conciliado. */
const COTEJO_TOLERANCIA = 0.01;

@Component({
  selector: 'app-tesoreria',
  imports: [LucideAngularModule, DecimalPipe, TesoresriaCasoDrawerComponent, RevisionMovimientosComponent],
  templateUrl: './tesoreria.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TesoreriaComponent implements OnInit, OnDestroy {
  private readonly casosService = inject(CasosService);
  private readonly companyService = inject(CompanyService);
  private readonly gestoriaService = inject(GestoriaService);

  readonly WalletIcon = Wallet;
  readonly TrendingUpIcon = TrendingUp;
  readonly TrendingDownIcon = TrendingDown;
  readonly LandmarkIcon = Landmark;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly SaveIcon = Save;
  readonly ScaleIcon = Scale;
  readonly TrendingUpDownIcon = TrendingUpDown;

  readonly casos = this.casosService.casos;
  readonly selectedCaso = signal<Caso | null>(null);
  readonly loading = this.casosService.loading;
  readonly savingSaldo = signal(false);

  /** Input editable del saldo bancario (string para el campo de texto). */
  readonly saldoBancarioInput = signal('');

  /** Contabilidad agregada de todos los casos a partir de sus resúmenes. */
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

  /** Casos con actividad financiera, ordenados por saldo descendente. */
  readonly casosContables = computed(() =>
    this.casos()
      .filter(c => {
        const r = c.resumenFinanciero;
        return (r?.totalIngresos || r?.totalSuplidos || r?.totalHonorarios);
      })
      .sort((a, b) => (b.resumenFinanciero?.saldo ?? 0) - (a.resumenFinanciero?.saldo ?? 0))
  );

  /** Saldo bancario guardado en la company activa. */
  readonly saldoBancario = computed(() => this.companyService.activeCompany()?.saldoBancario ?? null);
  readonly saldoBancarioFecha = computed(() => this.companyService.activeCompany()?.saldoBancarioFecha ?? null);

  /** Diferencia entre lo que dice el banco y lo que dice el sistema. */
  readonly cotejo = computed(() => {
    const banco = this.saldoBancario();
    if (banco === null) return null;
    const sistema = this.balanceGeneral().saldo;
    const diferencia = banco - sistema;
    return {
      banco,
      sistema,
      diferencia,
      conciliado: Math.abs(diferencia) < COTEJO_TOLERANCIA,
    };
  });

  /** Movimientos sin revisar (ni aprobados ni rechazados explícitamente). */
  private readonly movimientosPendientes = computed(() =>
    this.gestoriaService.todosMovimientos().filter(m => m.aprobado == null)
  );

  /** Saldo bancario proyectado: banco real ± impacto de movimientos pendientes. */
  readonly proyeccionBancaria = computed(() => {
    const banco = this.saldoBancario();
    const impacto = this.movimientosPendientes().reduce(
      (acc, m) => acc + (m.esEntrada ? m.importe : -m.importe),
      0
    );
    return { banco, impacto, proyeccion: banco !== null ? banco + impacto : null };
  });

  /** Importe neto de movimientos pendientes agrupados por casoId. */
  readonly pendientesPorCaso = computed(() => {
    const map = new Map<string, number>();
    for (const m of this.movimientosPendientes()) {
      const prev = map.get(m.casoId) ?? 0;
      map.set(m.casoId, prev + (m.esEntrada ? m.importe : -m.importe));
    }
    return map;
  });

  async ngOnInit(): Promise<void> {
    await this.casosService.loadCasos();
    this.gestoriaService.loadTodosMovimientos();
    const actual = this.saldoBancario();
    if (actual !== null) this.saldoBancarioInput.set(String(actual));
  }

  ngOnDestroy(): void {
    this.gestoriaService.stopTodosMovimientos();
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
