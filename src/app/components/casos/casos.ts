import { Component, OnInit, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, Briefcase, Plus, Search, Filter,
  AlertCircle, Clock, CheckCircle2, MoreHorizontal, X, Layers, TrendingUp,
} from 'lucide-angular';
import { CasosService } from '../../core/services/casos.service';
import { PlantillasService } from '../../core/services/plantillas.service';
import type { Caso, CasoEstado, CasoPrioridad, CasoTipo } from '../../interfaces';

@Component({
  selector: 'app-casos',
  imports: [LucideAngularModule, RouterLink, DecimalPipe],
  templateUrl: './casos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasosComponent implements OnInit {
  private readonly router = inject(Router);
  readonly casosService = inject(CasosService);
  readonly plantillasService = inject(PlantillasService);

  readonly BriefcaseIcon = Briefcase;
  readonly PlusIcon = Plus;
  readonly SearchIcon = Search;
  readonly FilterIcon = Filter;
  readonly AlertCircleIcon = AlertCircle;
  readonly ClockIcon = Clock;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly MoreHorizontalIcon = MoreHorizontal;
  readonly XIcon = X;
  readonly LayersIcon = Layers;
  readonly TrendingUpIcon = TrendingUp;

  search = signal('');
  filterEstado = signal('');
  filterTipo = signal('');
  showDrawer = signal(false);

  formTitulo = signal('');
  formDescripcion = signal('');
  formTipo = signal<CasoTipo>('Legal');
  formEstado = signal<CasoEstado>('pendiente');
  formPrioridad = signal<CasoPrioridad>('media');
  formVencimiento = signal('');
  formPlantillaId = signal('');
  formSaving = signal(false);

  filteredCasos = computed(() => {
    const q = this.search().toLowerCase();
    const e = this.filterEstado();
    const t = this.filterTipo();
    return this.casosService.casos().filter(c => {
      const matchSearch = !q || c.titulo.toLowerCase().includes(q) || (c.descripcion ?? '').toLowerCase().includes(q);
      const matchEstado = !e || c.estado === e;
      const matchTipo = !t || c.tipo === t;
      return matchSearch && matchEstado && matchTipo;
    });
  });

  enProceso = computed(() => this.casosService.casos().filter(c => c.estado === 'en_proceso').length);
  pendientes = computed(() => this.casosService.casos().filter(c => c.estado === 'pendiente').length);
  urgentes = computed(() => this.casosService.casos().filter(c => c.estado === 'urgente').length);
  saldoTotal = computed(() =>
    this.casosService.casos().reduce((sum, c) => sum + c.resumenFinanciero.saldo, 0)
  );

  estados: CasoEstado[] = ['pendiente', 'en_proceso', 'cerrado', 'urgente', 'archivado'];
  tipos: CasoTipo[] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];
  prioridades: CasoPrioridad[] = ['alta', 'media', 'baja'];

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.casosService.loadCasos(),
      this.plantillasService.loadPlantillas(),
    ]);
  }

  openDrawer(): void {
    this.formTitulo.set('');
    this.formDescripcion.set('');
    this.formTipo.set('Legal');
    this.formEstado.set('pendiente');
    this.formPrioridad.set('media');
    this.formVencimiento.set('');
    this.formPlantillaId.set('');
    this.showDrawer.set(true);
  }

  async saveNuevoCaso(): Promise<void> {
    const titulo = this.formTitulo().trim();
    if (!titulo) return;
    this.formSaving.set(true);
    try {
      const id = await this.casosService.createCaso({
        titulo,
        descripcion: this.formDescripcion().trim() || undefined,
        tipo: this.formTipo(),
        estado: this.formEstado(),
        prioridad: this.formPrioridad(),
        vencimiento: this.formVencimiento() || undefined,
        contactoIds: [],
        plantillaId: this.formPlantillaId() || undefined,
      });
      this.showDrawer.set(false);
      this.router.navigate(['/casos', id]);
    } finally {
      this.formSaving.set(false);
    }
  }

  navigateTo(caso: Caso): void {
    this.router.navigate(['/casos', caso.id]);
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
