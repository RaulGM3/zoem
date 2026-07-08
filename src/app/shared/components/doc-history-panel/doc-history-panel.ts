import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule, X, History, Download, FileText } from 'lucide-angular';
import { Timestamp } from '@angular/fire/firestore';
import { DocAuditService } from '../../../core/services/doc-audit.service';
import type { DocAuditEvent, DocVersionEntry } from '../../../interfaces/doc-lifecycle.interface';

const ACTION_LABELS: Record<DocAuditEvent['action'], string> = {
  create: 'Creó el documento',
  view: 'Lo visualizó',
  download: 'Lo descargó',
  update: 'Subió una nueva versión',
  delete: 'Lo eliminó',
  restore: 'Lo restauró',
  permission_change: 'Cambió los permisos',
};

/**
 * Drawer reutilizable con el historial de un documento: versiones descargables
 * y timeline de auditoría (quién creó, miró, descargó, actualizó o borró).
 */
@Component({
  selector: 'app-doc-history-panel',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="fixed inset-0 bg-black/30 z-40" (click)="closed.emit()" aria-hidden="true"></div>
    }
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-history-title"
      [class]="'fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col transition-transform duration-300 ' + (visible() ? 'translate-x-0' : 'translate-x-full')"
    >
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
            <lucide-icon [img]="HistoryIcon" class="w-4 h-4 text-violet-600" />
          </div>
          <h2 id="doc-history-title" class="text-base font-semibold text-slate-800 truncate">
            Historial · {{ title() }}
          </h2>
        </div>
        <button (click)="closed.emit()" class="p-1.5 hover:bg-slate-100 rounded-lg" aria-label="Cerrar">
          <lucide-icon [img]="XIcon" class="w-4 h-4 text-slate-700" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <!-- Versiones -->
        <section>
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Versiones</h3>
          @if (sortedVersions().length === 0) {
            <p class="text-sm text-slate-500">Sin historial de versiones (documento original).</p>
          } @else {
            <ul class="space-y-2">
              @for (v of sortedVersions(); track v.version) {
                <li class="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                  <span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-violet-100 text-violet-700 shrink-0">
                    v{{ v.version }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm text-slate-700 truncate">{{ v.name }}</p>
                    <p class="text-xs text-slate-500">
                      {{ v.uploadedByNombre || '—' }} · {{ formatDate(v.uploadedAt) }}
                    </p>
                  </div>
                  @if (v.downloadUrl) {
                    <a
                      [href]="v.downloadUrl"
                      target="_blank"
                      rel="noopener"
                      download
                      (click)="logVersionDownload(v)"
                      class="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 shrink-0"
                      [attr.aria-label]="'Descargar versión ' + v.version"
                    >
                      <lucide-icon [img]="DownloadIcon" class="w-4 h-4" />
                    </a>
                  }
                </li>
              }
            </ul>
          }
        </section>

        <!-- Auditoría -->
        <section>
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Actividad</h3>
          @if (loadingEvents()) {
            <p class="text-sm text-slate-500">Cargando actividad...</p>
          } @else if (events().length === 0) {
            <p class="text-sm text-slate-500">Sin actividad registrada todavía.</p>
          } @else {
            <ul class="space-y-3">
              @for (ev of events(); track ev.id) {
                <li class="flex items-start gap-3">
                  <div class="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center shrink-0" aria-hidden="true">
                    <lucide-icon [img]="FileTextIcon" class="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm text-slate-700">
                      <span class="font-medium">{{ ev.userNombre }}</span>
                      · {{ actionLabel(ev) }}
                      @if (ev.version) { <span class="text-slate-500">(v{{ ev.version }})</span> }
                    </p>
                    @if (ev.detail) {
                      <p class="text-xs text-slate-500 truncate">{{ ev.detail }}</p>
                    }
                    <p class="text-xs text-slate-400">{{ formatDate(ev.at) }}</p>
                  </div>
                </li>
              }
            </ul>
          }
        </section>
      </div>
    </div>
  `,
})
export class DocHistoryPanelComponent {
  private readonly docAudit = inject(DocAuditService);

  readonly visible = input.required<boolean>();
  readonly title = input<string>('');
  readonly versions = input<DocVersionEntry[]>([]);
  /** Path Firestore del doc padre (la subcolección doc_audit cuelga de ahí). */
  readonly parentPath = input<string | null>(null);

  readonly closed = output<void>();

  readonly XIcon = X;
  readonly HistoryIcon = History;
  readonly DownloadIcon = Download;
  readonly FileTextIcon = FileText;

  readonly events = signal<DocAuditEvent[]>([]);
  readonly loadingEvents = signal(false);

  readonly sortedVersions = computed(() =>
    [...this.versions()].sort((a, b) => b.version - a.version),
  );

  constructor() {
    effect(() => {
      const path = this.parentPath();
      if (!this.visible() || !path) return;
      this.loadingEvents.set(true);
      this.docAudit
        .listEvents(path)
        .then(list => this.events.set(list))
        .catch(() => this.events.set([]))
        .finally(() => this.loadingEvents.set(false));
    });
  }

  actionLabel(ev: DocAuditEvent): string {
    return ACTION_LABELS[ev.action] ?? ev.action;
  }

  logVersionDownload(v: DocVersionEntry): void {
    const path = this.parentPath();
    if (path) this.docAudit.log(path, 'download', { version: v.version, detail: v.name });
  }

  formatDate(ts: Timestamp | undefined): string {
    if (!ts) return '—';
    return ts.toDate().toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
