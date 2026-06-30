import { Component, ChangeDetectionStrategy, input, output, signal, effect, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, Landmark, Wallet, CheckCircle2, AlertTriangle, Save, Scale, History, X,
  Lock, ChevronDown,
} from 'lucide-angular';
import type { CierreCaja, CuentaBancaria, MovimientoGestoria, TesoreriaResumen } from '../../../../interfaces';

export type FiltroAprobado = 'pendientes' | 'aprobados' | 'todos';

export interface CotejoCuenta {
  cuenta: CuentaBancaria;
  ingresos: number;
  egresos: number;
  sistema: number;
  proyeccion: number;
  banco: number | null;
  diferencia: number | null;
  conciliado: boolean;
}

export interface CotejoLegacy {
  banco: number;
  sistema: number;
  diferencia: number;
  conciliado: boolean;
}

export type MovimientoEnriquecido = MovimientoGestoria & { casoNombre: string };

@Component({
  selector: 'app-tesoreria-resumen-tab',
  host: { class: 'block space-y-6' },
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './resumen-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TesoreriaResumenTabComponent {
  readonly cotejos = input.required<CotejoCuenta[]>();
  readonly movimientosPorCuenta = input.required<Map<string, MovimientoEnriquecido[]>>();
  readonly resumenHistorico = input.required<TesoreriaResumen | null>();
  readonly hayCuentas = input.required<boolean>();
  readonly cotejo = input<CotejoLegacy | null>(null);
  readonly saldoBancarioInput = input<string>('');
  readonly savingSaldo = input<boolean>(false);
  readonly saldoBancarioFecha = input<string | null>(null);

  readonly cierres = input<CierreCaja[]>([]);

  readonly actualizarSaldoCuenta = output<{ cuentaId: string; valor: string }>();
  readonly guardarSaldoBancario = output<string>();

  readonly LandmarkIcon = Landmark;
  readonly WalletIcon = Wallet;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly SaveIcon = Save;
  readonly ScaleIcon = Scale;
  readonly HistoryIcon = History;
  readonly XIcon = X;
  readonly LockIcon = Lock;
  readonly ChevronDownIcon = ChevronDown;

  readonly localSaldoInput = signal('');
  readonly cuentaSeleccionada = signal<string | null>(null);
  readonly filtros = signal<Record<string, FiltroAprobado>>({});
  readonly cierreExpandido = signal<string | null>(null);
  readonly hoveredDiscrepancia = signal<string | null>(null);
  readonly dialogDiscrepancia = signal<CotejoCuenta | null>(null);

  readonly cotejosFiltrados = computed(() => {
    const sel = this.cuentaSeleccionada();
    return sel ? this.cotejos().filter(c => c.cuenta.id === sel) : this.cotejos();
  });

  readonly movimientosFiltradosPorCuenta = computed(() => {
    const filtros = this.filtros();
    const resultado = new Map<string, MovimientoEnriquecido[]>();
    for (const [cuentaId, movs] of this.movimientosPorCuenta()) {
      const filtro: FiltroAprobado = filtros[cuentaId] ?? 'pendientes';
      resultado.set(cuentaId, movs.filter(m => {
        if (filtro === 'pendientes') return m.aprobado !== true;
        if (filtro === 'aprobados') return m.aprobado === true;
        return true;
      }));
    }
    return resultado;
  });

  toggleCuenta(id: string): void {
    this.cuentaSeleccionada.update(prev => prev === id ? null : id);
  }

  toggleCierre(id: string): void {
    this.cierreExpandido.update(prev => prev === id ? null : id);
  }

  getFiltro(cuentaId: string): FiltroAprobado {
    return this.filtros()[cuentaId] ?? 'pendientes';
  }

  setFiltro(cuentaId: string, valor: FiltroAprobado): void {
    this.filtros.update(prev => ({ ...prev, [cuentaId]: valor }));
  }

  constructor() {
    effect(() => {
      const v = this.saldoBancarioInput();
      if (v) this.localSaldoInput.set(v);
    });
  }
}
