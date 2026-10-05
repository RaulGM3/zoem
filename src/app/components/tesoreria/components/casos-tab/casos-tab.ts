import { Component, ChangeDetectionStrategy, inject, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { Caso } from '../../../../interfaces';
import { BreakpointService } from '../../../../core/services/breakpoint.service';
import {
  ResponsiveListComponent, ListCardDirective, ListTableDirective,
} from '../../../../shared/components/responsive-list/responsive-list';

export interface ResumenCaso {
  ingresos: number;
  honorarios: number;
  egresos: number;
  saldoAprobado: number;
  saldoProyectado: number;
}

@Component({
  selector: 'app-tesoreria-casos-tab',
  host: { class: 'block' },
  imports: [DecimalPipe, ResponsiveListComponent, ListCardDirective, ListTableDirective],
  templateUrl: './casos-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TesoreriaCasosTabComponent {
  protected readonly bp = inject(BreakpointService);

  readonly casosContables = input.required<Caso[]>();
  readonly resumenPorCaso = input.required<Map<string, ResumenCaso>>();
  // Totales del pie de tabla: siempre la suma de las mismas filas visibles
  // arriba (ver `casosFooterTotales` en tesoreria.ts) — nunca una fuente distinta.
  readonly totalIngresos = input.required<number>();
  readonly totalHonorarios = input.required<number>();
  readonly totalEgresos = input.required<number>();
  readonly saldoAprobado = input.required<number>();
  readonly saldoProyectado = input.required<number>();
  readonly loading = input.required<boolean>();

  readonly casoSeleccionado = output<Caso>();
}
