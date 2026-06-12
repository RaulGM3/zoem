import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, MoreHorizontal, Trash2 } from 'lucide-angular';
import type { Caso } from '../../../../interfaces';

@Component({
  selector: 'app-casos-table',
  host: { style: 'display: block' },
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './casos-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasosTableComponent {
  readonly casos = input.required<Caso[]>();
  readonly loading = input.required<boolean>();
  readonly casoClick = output<Caso>();
  readonly deleteCaso = output<Caso>();

  readonly MoreHorizontalIcon = MoreHorizontal;
  readonly TrashIcon = Trash2;

  readonly activeDropdown = signal<string | null>(null);
  readonly activeCaso = signal<Caso | null>(null);
  readonly dropdownPos = signal<{ top: number; right: number } | null>(null);
  readonly casoToDelete = signal<Caso | null>(null);

  toggleDropdown(caso: Caso, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeDropdown() === caso.id) {
      this.activeDropdown.set(null);
      this.activeCaso.set(null);
      this.dropdownPos.set(null);
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.dropdownPos.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      this.activeDropdown.set(caso.id);
      this.activeCaso.set(caso);
    }
  }

  openDeleteDialog(event: MouseEvent): void {
    event.stopPropagation();
    this.casoToDelete.set(this.activeCaso());
    this.activeDropdown.set(null);
    this.activeCaso.set(null);
    this.dropdownPos.set(null);
  }

  confirmDelete(): void {
    const caso = this.casoToDelete();
    if (caso) this.deleteCaso.emit(caso);
    this.casoToDelete.set(null);
  }

  cancelDelete(): void {
    this.casoToDelete.set(null);
  }

  getDiasVencimiento(vencimiento?: string): number {
    if (!vencimiento) return -1;
    const diff = new Date(vencimiento).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getHitosProgress(caso: Caso): string {
    const total = caso.hitos?.length ?? 0;
    if (total === 0) return '—';
    const completados = caso.hitos.filter(h => h.estado === 'completado').length;
    return `${completados}/${total}`;
  }

  getPriorityDot(prioridad: string): string {
    if (prioridad === 'alta') return 'bg-red-500';
    if (prioridad === 'media') return 'bg-amber-400';
    return 'bg-emerald-400';
  }

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

  getVencimientoClass(dias: number): string {
    if (dias < 0) return 'text-slate-400';
    if (dias <= 14) return 'text-red-600 font-semibold';
    if (dias <= 30) return 'text-amber-600';
    return 'text-slate-500';
  }
}
