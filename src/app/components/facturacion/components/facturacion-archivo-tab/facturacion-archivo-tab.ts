import { Component, ChangeDetectionStrategy, input, output, signal, effect, untracked } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet, SlicePipe } from '@angular/common';
import { LucideAngularModule, FileCheck, Download, Link, RefreshCw, CheckCircle2 } from 'lucide-angular';
import type { Invoice } from '../../../../core/services/invoice.service';
import { anuncioCambioVerifactu, colorTono, vistaVerifactu, type VistaVerifactu } from '../../../../core/verifactu/verifactu-ui';
import { Caso } from '../../../../interfaces';
import { ActionMenuComponent, type MenuAction } from '../../../../shared/components/action-menu/action-menu';
import {
  ListCardDirective,
  ListTableDirective,
  ResponsiveListComponent,
} from '../../../../shared/components/responsive-list/responsive-list';

@Component({
  selector: 'app-facturacion-archivo-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule, DecimalPipe, SlicePipe, NgTemplateOutlet, ActionMenuComponent,
    ResponsiveListComponent, ListCardDirective, ListTableDirective,
  ],
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

  /** Texto de la ÚNICA región viva de la tabla: solo cambios provocados por el usuario. */
  readonly anuncio = signal('');
  private seguimiento: { facturaId: string; referencia: string; antes: Pick<VistaVerifactu, 'estado' | 'etiqueta'> } | null = null;

  constructor() {
    effect(() => {
      const mapa = this.invoiceMap();
      const seguimiento = this.seguimiento;
      if (!seguimiento) return;
      untracked(() => {
        const inv = mapa.get(seguimiento.facturaId);
        const vista = inv ? vistaVerifactu(inv, Date.now()) : null;
        if (!vista) return;
        const texto = anuncioCambioVerifactu(seguimiento.antes, vista, seguimiento.referencia);
        if (texto === null) return;
        this.anuncio.set(texto);
        this.seguimiento = null;
      });
    });
  }

  /** Reintento del usuario: lo anuncia y empieza a seguir el cambio de estado de esa factura. */
  reintentar(caso: Caso): void {
    const facturaId = caso.facturaId;
    if (!facturaId) return;
    const referencia = `Caso ${caso.titulo}`;
    const vista = this.verifactuVista(facturaId);
    this.seguimiento = vista ? { facturaId, referencia, antes: { estado: vista.estado, etiqueta: vista.etiqueta } } : null;
    this.anuncio.set(`Reintentando el envío a Verifactu del caso ${caso.titulo}`);
    this.retryVerifactu.emit(facturaId);
  }

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

  /** Mismas condiciones que los botones de la tabla de escritorio. */
  accionesCaso(caso: Caso): MenuAction[] {
    const acciones: MenuAction[] = [];
    if (this.pdfUrl(caso.facturaId)) {
      acciones.push({ id: 'download', label: 'Descargar PDF', icon: Download });
      acciones.push({ id: 'copyLink', label: 'Copiar link de descarga', icon: Link });
    }
    if (this.verifactuVista(caso.facturaId)?.reintentable) {
      acciones.push({ id: 'retry', label: 'Reintentar envío a Verifactu', icon: RefreshCw });
    }
    if (this.canReabrir()) {
      acciones.push({ id: 'reopen', label: 'Reabrir caso', icon: CheckCircle2, disabled: this.saving() });
    }
    return acciones;
  }

  ejecutarAccion(caso: Caso, id: string): void {
    switch (id) {
      case 'download': this.downloadPdf.emit(caso.facturaId); break;
      case 'copyLink': this.copyPdfLink.emit(caso.facturaId); break;
      case 'retry': this.reintentar(caso); break;
      case 'reopen': this.reabrirCaso.emit(caso); break;
    }
  }
}
