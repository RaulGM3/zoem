import { Component, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, Wallet, TrendingUp, TrendingDown, Clock,
  AlertCircle, CheckCircle2, RefreshCw, ArrowRight, Building2, CreditCard,
} from 'lucide-angular';
import {
  TESORERIA_COBROS, BANCO_TRANSACCIONES, RENTABILIDAD_CLIENTES,
} from '../../data/dummy-data';
import { ChangeDetectionStrategy } from '@angular/core';

type TesoreriaTab = 'cobros' | 'conciliacion' | 'rentabilidad';

@Component({
  selector: 'app-tesoreria',
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './tesoreria.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TesoreriaComponent {
  readonly WalletIcon = Wallet;
  readonly TrendingUpIcon = TrendingUp;
  readonly TrendingDownIcon = TrendingDown;
  readonly ClockIcon = Clock;
  readonly AlertCircleIcon = AlertCircle;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly RefreshCwIcon = RefreshCw;
  readonly ArrowRightIcon = ArrowRight;
  readonly Building2Icon = Building2;
  readonly CreditCardIcon = CreditCard;

  activeTab = signal<TesoreriaTab>('cobros');

  cobros = TESORERIA_COBROS;
  transacciones = BANCO_TRANSACCIONES;
  rentabilidad = RENTABILIDAD_CLIENTES;

  stats = [
    { label: 'Efectivo disponible', value: '34.280 €', change: '+8% vs mes anterior', positive: true },
    { label: 'Previsión 30 días', value: '41.500 €', change: '6 cobros esperados', positive: true },
    { label: 'Previsión 60 días', value: '58.200 €', change: '12 cobros esperados', positive: true },
    { label: 'Cobros vencidos', value: '28.400 €', change: '4 facturas sin cobrar', positive: false },
  ];

  totalVencido = computed(() => this.cobros.reduce((s, c) => s + c.importe, 0));
  conciliadasCount = computed(() => this.transacciones.filter(t => t.estado === 'conciliado').length);
  conciliacionRate = computed(() => Math.round((this.conciliadasCount() / this.transacciones.length) * 100));

  getNivelClass(nivel: string): string {
    const map: Record<string, string> = {
      recordatorio: 'bg-blue-100 text-blue-700',
      formal: 'bg-amber-100 text-amber-700',
      remesa: 'bg-orange-100 text-orange-700',
      aviso_legal: 'bg-red-100 text-red-700',
    };
    return map[nivel] || 'bg-slate-100 text-slate-600';
  }

  getNivelLabel(nivel: string): string {
    const map: Record<string, string> = {
      recordatorio: 'Recordatorio',
      formal: 'Formal',
      remesa: 'Remesa',
      aviso_legal: 'Aviso Legal',
    };
    return map[nivel] || nivel;
  }

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      conciliado: 'bg-green-100 text-green-700',
      pendiente: 'bg-amber-100 text-amber-700',
      sin_conciliar: 'bg-red-100 text-red-700',
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      conciliado: 'Conciliado',
      pendiente: 'Pendiente',
      sin_conciliar: 'Sin conciliar',
    };
    return map[estado] || estado;
  }

  isPositive(importe: number): boolean {
    return importe >= 0;
  }
}
