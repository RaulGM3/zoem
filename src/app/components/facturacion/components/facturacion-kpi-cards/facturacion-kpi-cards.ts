import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, ShieldCheck, Landmark, Hourglass, AlertTriangle } from 'lucide-angular';
import type { ResumenFacturacion } from '../../../../core/facturacion/resumen-facturacion';

@Component({
  selector: 'app-facturacion-kpi-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './facturacion-kpi-cards.html',
})
export class FacturacionKpiCardsComponent {
  readonly resumen = input.required<ResumenFacturacion>();
  readonly verifactuActivo = input.required<boolean>();

  readonly ShieldCheckIcon = ShieldCheck;
  readonly LandmarkIcon = Landmark;
  readonly HourglassIcon = Hourglass;
  readonly AlertTriangleIcon = AlertTriangle;

  facturas(n: number): string {
    return n === 1 ? '1 factura' : `${n} facturas`;
  }
}
