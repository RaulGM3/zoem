import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { LucideAngularModule, FileCheck, Download, Link, ShieldCheck, ShieldAlert, ShieldX, CheckCircle2 } from 'lucide-angular';
import type { Invoice } from '../../../../core/services/invoice.service';
import type { VerifactuEstado } from '../../../../interfaces/verifactu.interface';
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

  readonly FileCheckIcon = FileCheck;
  readonly DownloadIcon = Download;
  readonly LinkIcon = Link;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly ShieldAlertIcon = ShieldAlert;
  readonly ShieldXIcon = ShieldX;
  readonly CheckCircle2Icon = CheckCircle2;

  pdfUrl(facturaId: string | undefined): string | undefined {
    if (!facturaId) return undefined;
    return this.invoiceMap().get(facturaId)?.pdfUrl;
  }

  verifactuEstado(facturaId?: string): VerifactuEstado | undefined {
    if (!facturaId) return undefined;
    return this.invoiceMap().get(facturaId)?.verifactu;
  }

  verifactuBadgeColor(facturaId?: string): string {
    const estado = this.verifactuEstado(facturaId)?.estado;
    if (estado === 'enviado') return 'var(--success)';
    if (estado === 'pendiente') return 'var(--warning)';
    if (estado === 'error') return 'var(--danger)';
    return 'var(--text-faint)';
  }

  verifactuBadgeIcon(facturaId?: string) {
    const estado = this.verifactuEstado(facturaId)?.estado;
    if (estado === 'enviado') return this.ShieldCheckIcon;
    if (estado === 'error') return this.ShieldXIcon;
    return this.ShieldAlertIcon;
  }
}
