import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, TrendingUp, Clock, Receipt, Euro } from 'lucide-angular';

export interface FacturacionTotales {
  ingresos: number;
  suplidos: number;
  honorarios: number;
  saldo: number;
}

@Component({
  selector: 'app-facturacion-kpi-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './facturacion-kpi-cards.html',
})
export class FacturacionKpiCardsComponent {
  readonly totales = input.required<FacturacionTotales>();

  readonly TrendingUpIcon = TrendingUp;
  readonly ClockIcon = Clock;
  readonly ReceiptIcon = Receipt;
  readonly EuroIcon = Euro;
}
