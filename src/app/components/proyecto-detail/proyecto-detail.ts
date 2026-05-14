import { Component, input, computed, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, ArrowLeft, Edit, Receipt, Calendar,
  Clock, Target, CheckCircle2, Circle, PlayCircle, FileText,
  User, Building2, Plus,
} from 'lucide-angular';
import { PROJECTS, DOCUMENTS, PROJECT_TASKS, PROJECT_HISTORY } from '../../data/dummy-data';

type ProyectoTab = 'tareas' | 'documentos' | 'historial';

@Component({
  selector: 'app-proyecto-detail',
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './proyecto-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProyectoDetailComponent {
  readonly ArrowLeftIcon = ArrowLeft;
  readonly EditIcon = Edit;
  readonly ReceiptIcon = Receipt;
  readonly CalendarIcon = Calendar;
  readonly ClockIcon = Clock;
  readonly TargetIcon = Target;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly CircleIcon = Circle;
  readonly PlayCircleIcon = PlayCircle;
  readonly FileTextIcon = FileText;
  readonly UserIcon = User;
  readonly Building2Icon = Building2;
  readonly PlusIcon = Plus;

  id = input.required<string>();
  private router = inject(Router);

  activeTab = signal<ProyectoTab>('tareas');

  proyecto = computed(() => PROJECTS.find(p => p.id === this.id()) ?? null);

  tareas = computed(() => PROJECT_TASKS[this.id()] ?? []);
  historial = computed(() => PROJECT_HISTORY[this.id()] ?? []);

  documentos = computed(() =>
    DOCUMENTS.filter(d => {
      const p = this.proyecto();
      return p ? d.client === p.client : false;
    })
  );

  completadas = computed(() => this.tareas().filter(t => t.estado === 'completada').length);

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'En curso': 'bg-blue-100 text-blue-700',
      Pendiente: 'bg-amber-100 text-amber-700',
      'En espera': 'bg-slate-100 text-slate-600',
      Completado: 'bg-green-100 text-green-700',
      Archivado: 'bg-slate-100 text-slate-500',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  }

  getPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      alta: 'bg-red-100 text-red-700',
      media: 'bg-amber-100 text-amber-700',
      baja: 'bg-slate-100 text-slate-500',
    };
    return map[priority] || 'bg-slate-100 text-slate-600';
  }

  getTareaIcon(estado: string): string {
    if (estado === 'completada') return 'check';
    if (estado === 'en_proceso') return 'play';
    return 'circle';
  }

  getTareaClass(estado: string): string {
    const map: Record<string, string> = {
      completada: 'text-emerald-500',
      en_proceso: 'text-blue-500',
      pendiente: 'text-slate-300',
    };
    return map[estado] || 'text-slate-300';
  }

  volver() {
    this.router.navigate(['/proyectos']);
  }
}
