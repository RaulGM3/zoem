import { Component, OnInit, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  FileText,
  Search,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
} from 'lucide-angular';
import { Timestamp } from '@angular/fire/firestore';
import { DocTemplateService } from '../../core/services/doc-template.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import type { DocTemplate, DocTemplateStatus } from '../../interfaces';
import { NuevaPlantillaDrawerComponent } from './components/nueva-plantilla-drawer/nueva-plantilla-drawer';

@Component({
  selector: 'app-documentos',
  imports: [LucideAngularModule, NuevaPlantillaDrawerComponent],
  templateUrl: './documentos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentosComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly templateService = inject(DocTemplateService);
  readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);

  readonly FileTextIcon = FileText;
  readonly SearchIcon = Search;
  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly SparklesIcon = Sparkles;
  readonly ArrowRightIcon = ArrowRight;

  readonly search = signal('');
  readonly showDrawer = signal(false);
  readonly deletingId = signal<string | null>(null);

  readonly templates = this.templateService.templates;
  readonly loading = this.templateService.loading;

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.templates().filter(t =>
      !q || t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q)
    );
  });

  readonly total = computed(() => this.templates().length);
  readonly listas = computed(() => this.templates().filter(t => t.status === 'listo').length);
  readonly totalVariables = computed(() =>
    this.templates().reduce((sum, t) => sum + (t.variables?.length ?? 0), 0)
  );

  async ngOnInit(): Promise<void> {
    await this.templateService.loadTemplates();
  }

  openTemplate(template: DocTemplate): void {
    this.router.navigate(['/documentos', template.id]);
  }

  onSaved(id: string): void {
    this.showDrawer.set(false);
    this.router.navigate(['/documentos', id]);
  }

  async confirmDelete(template: DocTemplate): Promise<void> {
    await this.toast.run(() => this.templateService.deleteTemplate(template.id), {
      successMessage: 'Plantilla eliminada',
      errorTitle: 'No se pudo eliminar la plantilla',
      onSuccess: () => this.deletingId.set(null),
    });
  }

  getStatusLabel(status: DocTemplateStatus): string {
    const map: Record<DocTemplateStatus, string> = {
      procesando: 'Procesando',
      revision: 'En revisión',
      listo: 'Lista',
      error: 'Error',
    };
    return map[status] ?? status;
  }

  getStatusClass(status: DocTemplateStatus): string {
    const map: Record<DocTemplateStatus, string> = {
      procesando: 'bg-blue-100 text-blue-700',
      revision: 'bg-amber-100 text-amber-700',
      listo: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700',
    };
    return map[status] ?? 'bg-slate-100 text-slate-600';
  }

  formatDate(ts?: Timestamp): string {
    if (!ts || typeof ts.toDate !== 'function') return '—';
    const d = ts.toDate();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
}
