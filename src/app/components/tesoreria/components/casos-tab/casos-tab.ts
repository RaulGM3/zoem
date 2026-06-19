import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { Caso } from '../../../../interfaces';

export interface ResumenCaso {
  ingresos: number;
  egresos: number;
  saldoAprobado: number;
  saldoProyectado: number;
}

export interface BalanceGeneral {
  totalIngresos: number;
  totalSuplidos: number;
  totalHonorarios: number;
  saldo: number;
}

export interface ProyeccionBancaria {
  aprobado: number;
  impacto: number;
  proyeccion: number;
}

@Component({
  selector: 'app-tesoreria-casos-tab',
  host: { class: 'block' },
  imports: [DecimalPipe],
  templateUrl: './casos-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TesoreriaCasosTabComponent {
  readonly casosContables = input.required<Caso[]>();
  readonly resumenPorCaso = input.required<Map<string, ResumenCaso>>();
  readonly balanceGeneral = input.required<BalanceGeneral>();
  readonly totalEgresos = input.required<number>();
  readonly saldoAprobado = input.required<number>();
  readonly proyeccionBancaria = input.required<ProyeccionBancaria>();
  readonly loading = input.required<boolean>();

  readonly casoSeleccionado = output<Caso>();
}
