import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import {
  LucideAngularModule, Briefcase, Plus, Search, Filter,
  AlertCircle, Clock, CheckCircle2, MoreHorizontal,
} from 'lucide-angular';
import { CASOS } from '../../data/dummy-data';
import type { Caso } from '../../interfaces';

@Component({
  selector: 'app-casos',
  imports: [LucideAngularModule],
  templateUrl: './casos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasosComponent {
  readonly BriefcaseIcon = Briefcase;
  readonly PlusIcon = Plus;
  readonly SearchIcon = Search;
  readonly FilterIcon = Filter;
  readonly AlertCircleIcon = AlertCircle;
  readonly ClockIcon = Clock;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly MoreHorizontalIcon = MoreHorizontal;

  search = signal('');
  filterEstado = signal('');
  filterTipo = signal('');

  casos = CASOS;

  filteredCasos = computed(() => {
    const q = this.search().toLowerCase();
    const e = this.filterEstado();
    const t = this.filterTipo();
    return this.casos.filter(c => {
      const matchSearch = !q || c.cliente.toLowerCase().includes(q) || c.descripcion.toLowerCase().includes(q);
      const matchEstado = !e || c.estado === e;
      const matchTipo = !t || c.tipo === t;
      return matchSearch && matchEstado && matchTipo;
    });
  });

  enProceso = computed(() => this.casos.filter(c => c.estado === 'en_proceso').length);
  pendientes = computed(() => this.casos.filter(c => c.estado === 'pendiente').length);
  urgentes = computed(() => this.casos.filter(c => c.estado === 'urgente').length);

  estados = ['pendiente', 'en_proceso', 'cerrado', 'urgente'];
  tipos: Caso['tipo'][] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];

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
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }

  getTipoClass(tipo: string): string {
    const map: Record<string, string> = {
      Legal: 'bg-violet-100 text-violet-700',
      Fiscal: 'bg-blue-100 text-blue-700',
      Laboral: 'bg-amber-100 text-amber-700',
      Mercantil: 'bg-emerald-100 text-emerald-700',
      Civil: 'bg-slate-100 text-slate-600',
    };
    return map[tipo] || 'bg-slate-100 text-slate-600';
  }

  getVencimientoClass(dias: number): string {
    if (dias < 0) return 'text-slate-400';
    if (dias <= 14) return 'text-red-600 font-semibold';
    if (dias <= 30) return 'text-amber-600';
    return 'text-slate-500';
  }
}
