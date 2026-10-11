import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { LucideAngularModule, ShieldCheck, Landmark, Hourglass, AlertTriangle } from 'lucide-angular';
import type { ResumenFacturacion } from '../../../../core/facturacion/resumen-facturacion';
import { ImportePipe } from '../../../../core/moneda/importe.pipe';

@Component({
  selector: 'app-facturacion-kpi-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportePipe, LucideAngularModule],
  templateUrl: './facturacion-kpi-cards.html',
})
export class FacturacionKpiCardsComponent {
  readonly resumen = input.required<ResumenFacturacion>();
  readonly verifactuActivo = input.required<boolean>();
  /** Verifactu y el modelo 303 son de España: fuera de ella no se muestran. */
  readonly esEspana = input(true);

  readonly ShieldCheckIcon = ShieldCheck;
  readonly LandmarkIcon = Landmark;
  readonly HourglassIcon = Hourglass;
  readonly AlertTriangleIcon = AlertTriangle;

  facturas(n: number): string {
    return n === 1 ? '1 factura' : `${n} facturas`;
  }
}
