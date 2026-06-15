import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { LucideAngularModule, ArrowLeft, Edit2 } from 'lucide-angular';
import { RouterLink } from '@angular/router';

export type CasoTab = 'info' | 'hitos' | 'gestoria' | 'documentos';

@Component({
  selector: 'app-caso-detail-header',
  host: { style: 'display: block' },
  imports: [LucideAngularModule, RouterLink],
  templateUrl: './caso-detail-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoDetailHeaderComponent {
  readonly titulo = input.required<string>();
  readonly estado = input.required<string>();
  readonly tipo = input.required<string>();
  readonly editing = input.required<boolean>();
  readonly activeTab = input.required<CasoTab>();
  readonly hitosCount = input.required<number>();
  readonly movimientosCount = input.required<number>();
  readonly gestoriaPending = input.required<number>();
  readonly docsPending = input.required<number>();

  readonly edit = output<void>();
  readonly tabChange = output<CasoTab>();

  readonly ArrowLeftIcon = ArrowLeft;
  readonly Edit2Icon = Edit2;

  readonly tabs: readonly [CasoTab, string][] = [
    ['info', 'Información'],
    ['hitos', 'Hitos'],
    ['gestoria', 'Gestoría'],
    ['documentos', 'Documentos'],
  ];

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'bg-amber-100 text-amber-700',
      en_proceso: 'bg-blue-100 text-blue-700',
      cerrado: 'bg-slate-100 text-slate-500',
      urgente: 'bg-red-100 text-red-700',
      archivado: 'bg-slate-100 text-slate-400',
    };
    return map[estado] ?? 'bg-slate-100 text-slate-600';
  }

  getTipoClass(tipo: string): string {
    const map: Record<string, string> = {
      Legal: 'bg-violet-100 text-violet-700',
      Fiscal: 'bg-blue-100 text-blue-700',
      Laboral: 'bg-amber-100 text-amber-700',
      Mercantil: 'bg-emerald-100 text-emerald-700',
      Civil: 'bg-slate-100 text-slate-600',
    };
    return map[tipo] ?? 'bg-slate-100 text-slate-600';
  }
}
