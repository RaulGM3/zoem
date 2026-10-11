import { Component, ChangeDetectionStrategy, computed, inject, input, output } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { LucideAngularModule, Download, BarChart3 } from 'lucide-angular';
import {
  ResponsiveListComponent, ListCardDirective, ListTableDirective,
} from '../../../../shared/components/responsive-list/responsive-list';
import { ImportePipe } from '../../../../core/moneda/importe.pipe';
import { FiscalEmpresaService } from '../../../../core/fiscal/fiscal-empresa.service';

export interface ReporteTipo {
  tipo: string;
  importe: number;
  base: number;
  cuota: number;
  count: number;
}

export interface Reporte {
  porTipo: ReporteTipo[];
  ingresos: number;
  egresos: number;
  saldo: number;
  ivaRepercutido: number;
  ivaSoportado: number;
  liquidacionIva: number;
  totalMovimientos: number;
}

@Component({
  selector: 'app-reportes-tab',
  host: { style: 'display: block' },
  imports: [ImportePipe, LucideAngularModule, TitleCasePipe, ResponsiveListComponent, ListCardDirective, ListTableDirective],
  templateUrl: './reportes-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportesTabComponent {
  /** El modelo 303 es la liquidación de IVA española: fuera de España el rótulo es genérico. */
  protected readonly fiscal = inject(FiscalEmpresaService);

  readonly reporte = input.required<Reporte>();
  readonly desde = input<string>('');
  readonly hasta = input<string>('');

  readonly desdeChange = output<string>();
  readonly hastaChange = output<string>();
  readonly exportar = output<void>();

  readonly tiposConMovimientos = computed(() => this.reporte().porTipo.filter(r => r.count > 0));

  readonly DownloadIcon = Download;
  readonly BarChart3Icon = BarChart3;
}
