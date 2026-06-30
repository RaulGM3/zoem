import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, X, ShieldCheck } from 'lucide-angular';
import type { InvoiceLinea } from '../../../../core/services/invoice.service';
import { Caso } from '../../../../interfaces';

@Component({
  selector: 'app-factura-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './factura-drawer.html',
})
export class FacturaDrawerComponent {
  readonly caso = input.required<Caso>();
  readonly lineas = input.required<InvoiceLinea[]>();
  readonly ivaRate = input.required<number>();
  readonly facturaPreview = input.required<{ base: number; iva: number; total: number }>();
  readonly saving = input.required<boolean>();
  readonly verifactuEnabled = input<boolean>(false);

  readonly closed = output<void>();
  readonly confirmed = output<void>();
  readonly lineaBaseChanged = output<{ index: number; value: string }>();
  readonly lineaIvaToggled = output<number>();
  readonly ivaRateChanged = output<string>();

  readonly XIcon = X;
  readonly ShieldCheckIcon = ShieldCheck;
}
