import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Receipt, CheckCircle2, FileCheck, ChevronDown, ExternalLink } from 'lucide-angular';
import type { Invoice } from '../../../../core/services/invoice.service';
import { estiloEstadoFactura, etiquetaEstadoFactura } from '../../../../core/facturacion/estado-factura';
import { Caso, gestoriaCompleta } from '../../../../interfaces';

@Component({
  selector: 'app-facturacion-casos-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe, RouterLink],
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

  readonly ReceiptIcon = Receipt;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly FileCheckIcon = FileCheck;
  readonly ChevronDownIcon = ChevronDown;
  readonly ExternalLinkIcon = ExternalLink;

  readonly estadoEstilo = estiloEstadoFactura;
  readonly estadoEtiqueta = etiquetaEstadoFactura;

  /** Casos con la lista de facturas desplegada. */
  private readonly expandidos = signal<ReadonlySet<string>>(new Set());

  expandido(casoId: string): boolean {
    return this.expandidos().has(casoId);
  }

  toggleFacturas(casoId: string): void {
    this.expandidos.update((actual) => {
      const siguiente = new Set(actual);
      if (!siguiente.delete(casoId)) siguiente.add(casoId);
      return siguiente;
    });
  }

  /** Devuelve los IDs de factura del caso (soporta facturaIds[] y legacy facturaId). */
  invoiceIds(caso: Caso): string[] {
    if (caso.facturaIds?.length) return caso.facturaIds;
    return caso.facturaId ? [caso.facturaId] : [];
  }

  invoiceCount(caso: Caso): number {
    return this.invoiceIds(caso).length;
  }

  invoice(facturaId: string): Invoice | undefined {
    return this.invoiceMap().get(facturaId);
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
