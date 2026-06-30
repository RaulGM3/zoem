import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, Receipt, CheckCircle2, FileCheck, Download, Link } from 'lucide-angular';
import type { Invoice } from '../../../../core/services/invoice.service';
import { Caso, gestoriaCompleta } from '../../../../interfaces';

@Component({
  selector: 'app-facturacion-casos-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './facturacion-casos-tab.html',
})
export class FacturacionCasosTabComponent {
  readonly casos = input.required<Caso[]>();
  readonly loading = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly canCreate = input.required<boolean>();
  readonly invoiceMap = input.required<Map<string, Invoice>>();

  readonly abrirFactura = output<Caso>();
  readonly abrirCierre = output<Caso>();
  readonly downloadPdf = output<string | undefined>();
  readonly copyPdfLink = output<string | undefined>();

  readonly ReceiptIcon = Receipt;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly FileCheckIcon = FileCheck;
  readonly DownloadIcon = Download;
  readonly LinkIcon = Link;

  pdfUrl(facturaId: string | undefined): string | undefined {
    if (!facturaId) return undefined;
    return this.invoiceMap().get(facturaId)?.pdfUrl;
  }

  esEjecutado(caso: Caso): boolean {
    return gestoriaCompleta(caso);
  }

  slotsLabel(caso: Caso): string {
    const r = caso.gestoriaResumenSlots;
    if (!r || r.total === 0) return 'Sin costos previstos';
    return `${r.registrados}/${r.total} registrados`;
  }
}
