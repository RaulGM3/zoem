import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { LucideAngularModule, FileCheck, Download, Link, RefreshCw, CheckCircle2 } from 'lucide-angular';
import type { Invoice } from '../../../../core/services/invoice.service';
import { colorTono, vistaVerifactu, type VistaVerifactu } from '../../../../core/verifactu/verifactu-ui';
import { Caso } from '../../../../interfaces';

@Component({
  selector: 'app-facturacion-archivo-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe, SlicePipe],
  templateUrl: './facturacion-archivo-tab.html',
})
export class FacturacionArchivoTabComponent {
  readonly casos = input.required<Caso[]>();
  readonly saving = input.required<boolean>();
  readonly canReabrir = input.required<boolean>();
  readonly invoiceMap = input.required<Map<string, Invoice>>();

  readonly navigateToCaso = output<string>();
  readonly reabrirCaso = output<Caso>();
  readonly downloadPdf = output<string | undefined>();
  readonly copyPdfLink = output<string | undefined>();
  readonly retryVerifactu = output<string>();

  readonly FileCheckIcon = FileCheck;
  readonly DownloadIcon = Download;
  readonly LinkIcon = Link;
  readonly RefreshCwIcon = RefreshCw;
  readonly CheckCircle2Icon = CheckCircle2;

  pdfUrl(facturaId: string | undefined): string | undefined {
    if (!facturaId) return undefined;
    return this.invoiceMap().get(facturaId)?.pdfUrl;
  }

  /** Vista del registro Verifactu de la factura del caso; `Date.now()` se lee al renderizar. */
  verifactuVista(facturaId?: string): VistaVerifactu | null {
    if (!facturaId) return null;
    const invoice = this.invoiceMap().get(facturaId);
    return invoice ? vistaVerifactu(invoice, Date.now()) : null;
  }

  verifactuColor(vista: VistaVerifactu): string {
    return colorTono(vista.tono);
  }
}
