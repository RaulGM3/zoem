import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Receipt, Search, Plus, TrendingUp, Clock, CheckCircle2,
  AlertCircle, Download, Send, Eye, MoreHorizontal, Euro,
  FileText, ShieldCheck, ExternalLink, Timer,
} from 'lucide-angular';
import { INVOICES, REGISTRO_HORAS } from '../../data/dummy-data';

type FacturacionTab = 'facturas' | 'fiscal' | 'horas';

const MODELOS_FISCALES = [
  { modelo: 'Modelo 303', descripcion: 'IVA — 2º Trimestre 2026', estado: 'pendiente', importe: 3240, vencimiento: '20 Jul 2026' },
  { modelo: 'Modelo 130', descripcion: 'IRPF fraccionado — 2T 2026', estado: 'pendiente', importe: 1180, vencimiento: '20 Jul 2026' },
  { modelo: 'Modelo 111', descripcion: 'Retenciones IRPF — 2T 2026', estado: 'borrador', importe: 890, vencimiento: '20 Jul 2026' },
  { modelo: 'Modelo 303', descripcion: 'IVA — 1º Trimestre 2026', estado: 'presentado', importe: 2980, vencimiento: '20 Abr 2026' },
];

@Component({
  selector: 'app-facturacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, DecimalPipe],
  templateUrl: './facturacion.html',
})
export class FacturacionComponent {
  readonly ReceiptIcon = Receipt;
  readonly SearchIcon = Search;
  readonly PlusIcon = Plus;
  readonly TrendingUpIcon = TrendingUp;
  readonly ClockIcon = Clock;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly AlertCircleIcon = AlertCircle;
  readonly DownloadIcon = Download;
  readonly SendIcon = Send;
  readonly EyeIcon = Eye;
  readonly MoreHorizontalIcon = MoreHorizontal;
  readonly EuroIcon = Euro;
  readonly FileTextIcon = FileText;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly ExternalLinkIcon = ExternalLink;
  readonly TimerIcon = Timer;

  activeTab = signal<FacturacionTab>('facturas');

  invoices = INVOICES;
  registroHoras = REGISTRO_HORAS;
  modelosFiscales = MODELOS_FISCALES;

  search = signal('');
  filterStatus = signal('');

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    const s = this.filterStatus();
    return this.invoices.filter((inv) => {
      const matchQ = !q || inv.client.toLowerCase().includes(q) || inv.number.includes(q);
      const matchS = !s || inv.status === s;
      return matchQ && matchS;
    });
  });

  totalInvoiced(): number {
    return this.invoices.filter((i) => i.status === 'pagada').reduce((sum, i) => sum + i.total, 0);
  }

  totalPending(): number {
    return this.invoices.filter((i) => i.status === 'pendiente').reduce((sum, i) => sum + i.total, 0);
  }

  totalOverdue(): number {
    return this.invoices.filter((i) => i.status === 'vencida').reduce((sum, i) => sum + i.total, 0);
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      pagada: 'bg-green-100 text-green-700',
      pendiente: 'bg-amber-100 text-amber-700',
      vencida: 'bg-red-100 text-red-700',
      borrador: 'bg-slate-100 text-slate-500',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pagada: 'Pagada',
      pendiente: 'Pendiente',
      vencida: 'Vencida',
      borrador: 'Borrador',
    };
    return map[status] || status;
  }

  getModeloEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'bg-amber-100 text-amber-700',
      presentado: 'bg-green-100 text-green-700',
      borrador: 'bg-slate-100 text-slate-500',
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }

  getHoraEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      facturado: 'bg-green-100 text-green-700',
      pendiente: 'bg-amber-100 text-amber-700',
      no_facturable: 'bg-slate-100 text-slate-500',
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }

  totalHoras = computed(() => this.registroHoras.reduce((s, h) => s + h.horas, 0));
  horasPendientes = computed(() =>
    this.registroHoras.filter(h => h.estadoFacturacion === 'pendiente').reduce((s, h) => s + h.horas, 0)
  );
}
