import { Component, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  FolderKanban,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Clock,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Filter,
  ArrowRight,
} from 'lucide-angular';
import { PROJECTS } from '../../data/dummy-data';
import type { Project } from '../../interfaces';

@Component({
  selector: 'app-proyectos',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, DecimalPipe],
  templateUrl: './proyectos.html',
})
export class ProyectosComponent {
  readonly FolderKanbanIcon = FolderKanban;
  readonly SearchIcon = Search;
  readonly PlusIcon = Plus;
  readonly EyeIcon = Eye;
  readonly EditIcon = Edit;
  readonly Trash2Icon = Trash2;
  readonly CalendarIcon = Calendar;
  readonly ClockIcon = Clock;
  readonly ChevronRightIcon = ChevronRight;
  readonly AlertCircleIcon = AlertCircle;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly FilterIcon = Filter;
  readonly ArrowRightIcon = ArrowRight;

  search = signal('');
  filterStatus = signal('');

  projects = PROJECTS;

  filteredProjects = computed(() => {
    const q = this.search().toLowerCase();
    const s = this.filterStatus();
    return this.projects.filter((p) => {
      const matchSearch = !q || p.client.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      const matchStatus = !s || p.status === s;
      return matchSearch && matchStatus;
    });
  });

  statuses = ['En curso', 'Pendiente', 'En espera', 'Completado', 'Archivado'];

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

  getPriorityDot(priority: string): string {
    if (priority === 'alta') return 'bg-red-500';
    if (priority === 'media') return 'bg-amber-400';
    return 'bg-slate-300';
  }

  getDeadlineClass(days?: number): string {
    if (!days) return 'text-slate-400';
    if (days <= 7) return 'text-red-600 font-semibold';
    if (days <= 21) return 'text-amber-600';
    return 'text-slate-500';
  }

  totalBudget(): number {
    return this.projects.reduce((sum, p) => sum + (p.budget || 0), 0);
  }

  activeCount(): number {
    return this.projects.filter((p) => p.status === 'En curso').length;
  }

  urgentCount(): number {
    return this.projects.filter((p) => p.daysToDeadline !== undefined && p.daysToDeadline <= 14).length;
  }
}
