import {
  Component, ChangeDetectionStrategy, input, output, signal, computed, inject, OnInit,
} from '@angular/core';
import {
  LucideAngularModule, X, Search, Folder, FolderOpen, ChevronRight, Check,
  Loader, AlertTriangle, Link,
} from 'lucide-angular';
import { CasosService } from '../../../core/services/casos.service';
import { CasoDocService } from '../../../core/services/caso-doc.service';
import { DocGenerationService } from '../../../core/services/doc-generation.service';
import { ToastService } from '../../../core/services/toast.service';
import { PermissionService } from '../../../core/services/permission.service';
import { FocusTrapDirective } from '../../../shared/directives/focus-trap.directive';
import type { Caso, CasoDocFolder, DocTemplate } from '../../../interfaces';

type Step = 'search' | 'folder';

@Component({
  selector: 'app-anclar-caso-dialog',
  imports: [LucideAngularModule, FocusTrapDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4',
    '(click)': 'close.emit()',
  },
  template: `
    <div
      class="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
      style="max-height: 80vh"
      (click)="$event.stopPropagation()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="anclar-dialog-title"
      appFocusTrap
      (escapeKey)="close.emit()"
    >
      <!-- Header -->
      <div class="flex items-center gap-3 px-5 py-4 border-b border-slate-200 shrink-0">
        <lucide-icon [img]="LinkIcon" class="w-5 h-5 text-violet-500 shrink-0" />
        <div class="flex-1 min-w-0">
          <p id="anclar-dialog-title" class="text-sm font-semibold text-slate-800">
            Anclar a un caso
          </p>
          <p class="text-xs text-slate-400 truncate">{{ template().name }}</p>
        </div>
        <!-- Step indicator -->
        <div class="flex items-center gap-1.5 shrink-0">
          <span
            class="w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold"
            [class]="step() === 'search' ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-600'"
          >1</span>
          <lucide-icon [img]="ChevronRightIcon" class="w-3.5 h-3.5 text-slate-300" />
          <span
            class="w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold"
            [class]="step() === 'folder' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'"
          >2</span>
        </div>
        <button
          (click)="close.emit()"
          class="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 shrink-0"
          aria-label="Cerrar"
        >
          <lucide-icon [img]="XIcon" class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 min-h-0 overflow-y-auto">

        @if (step() === 'search') {
          <!-- PASO 1: buscar caso -->
          <div class="p-4 space-y-3">
            <p class="text-xs text-slate-500">Busca el caso donde quieres guardar el documento.</p>

            @if (requiredPending() > 0) {
              <div class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <lucide-icon [img]="AlertTriangleIcon" class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p class="text-xs text-amber-700">
                  <strong>{{ requiredPending() }} campo(s) obligatorio(s)</strong> sin rellenar. El documento se anclará con esos campos vacíos.
                </p>
              </div>
            }

            <div class="relative">
              <lucide-icon [img]="SearchIcon" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="search"
                [value]="search()"
                (input)="search.set($any($event.target).value)"
                placeholder="Buscar por nombre del caso…"
                class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
                aria-label="Buscar caso"
              />
            </div>

            @if (loadingCasos()) {
              <div class="flex items-center justify-center py-8 text-slate-400 text-sm gap-2">
                <lucide-icon [img]="LoaderIcon" class="w-4 h-4 animate-spin" />
                Cargando casos...
              </div>
            } @else if (filteredCasos().length === 0) {
              <p class="text-center text-sm text-slate-400 py-8">
                {{ search() ? 'No hay casos que coincidan.' : 'No hay casos disponibles.' }}
              </p>
            } @else {
              <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden" role="listbox">
                @for (caso of filteredCasos(); track caso.id) {
                  <li>
                    <button
                      (click)="selectCaso(caso)"
                      class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-50 transition-colors group"
                      role="option"
                      [attr.aria-selected]="false"
                    >
                      <span class="w-2 h-2 rounded-full shrink-0"
                        [style.background]="estadoColor(caso.estado)"></span>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-slate-800 truncate">{{ caso.titulo }}</p>
                        <p class="text-xs text-slate-400">{{ caso.tipo }} · {{ caso.estado }}</p>
                      </div>
                      <lucide-icon [img]="ChevronRightIcon" class="w-4 h-4 text-slate-300 group-hover:text-violet-400" />
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
        }

        @if (step() === 'folder') {
          <!-- PASO 2: elegir carpeta -->
          <div class="p-4 space-y-3">
            <div class="flex items-center gap-2">
              <button
                (click)="goBack()"
                class="text-xs text-violet-600 hover:text-violet-500 flex items-center gap-1"
              >
                <lucide-icon [img]="ChevronRightIcon" class="w-3 h-3 rotate-180" />
                Volver
              </button>
              <span class="text-xs text-slate-400">·</span>
              <p class="text-xs text-slate-700 font-medium truncate">{{ selectedCaso()?.titulo }}</p>
            </div>

            <p class="text-xs text-slate-500">Elige dónde guardar el documento dentro del caso.</p>

            @if (loadingFolders()) {
              <div class="flex items-center justify-center py-6 text-slate-400 text-sm gap-2">
                <lucide-icon [img]="LoaderIcon" class="w-4 h-4 animate-spin" />
                Cargando carpetas...
              </div>
            } @else {
              <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden" role="listbox">
                <!-- Raíz siempre disponible -->
                <li>
                  <button
                    (click)="selectedFolderId.set(null)"
                    class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-50 transition-colors"
                    role="option"
                    [attr.aria-selected]="selectedFolderId() === null"
                  >
                    <lucide-icon [img]="FolderOpenIcon" class="w-4 h-4 shrink-0 text-amber-400" />
                    <span class="flex-1 text-sm text-slate-700">Raíz (sin carpeta)</span>
                    @if (selectedFolderId() === null) {
                      <lucide-icon [img]="CheckIcon" class="w-4 h-4 text-violet-500 shrink-0" />
                    }
                  </button>
                </li>
                @for (folder of folderTree(); track folder.id) {
                  <li>
                    <button
                      (click)="selectedFolderId.set(folder.id)"
                      class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-50 transition-colors"
                      role="option"
                      [attr.aria-selected]="selectedFolderId() === folder.id"
                    >
                      <lucide-icon [img]="FolderIcon" class="w-4 h-4 shrink-0 text-amber-400" [style.margin-left.px]="folder.depth * 12" />
                      <span class="flex-1 text-sm text-slate-700 truncate">{{ folder.name }}</span>
                      @if (selectedFolderId() === folder.id) {
                        <lucide-icon [img]="CheckIcon" class="w-4 h-4 text-violet-500 shrink-0" />
                      }
                    </button>
                  </li>
                }
                @if (folders().length === 0) {
                  <li class="px-4 py-3 text-xs text-slate-400 text-center">Este caso no tiene carpetas</li>
                }
              </ul>
            }
          </div>
        }

      </div>

      <!-- Footer (solo en paso 2) -->
      @if (step() === 'folder') {
        <div class="px-5 py-4 border-t border-slate-200 shrink-0 flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-xs text-slate-500">
              Guardar en:
              <span class="font-medium text-slate-700">
                {{ selectedFolderId() ? (folderById(selectedFolderId()!)?.name ?? 'Carpeta') : 'Raíz' }}
              </span>
            </p>
          </div>
          <button
            (click)="anchor()"
            [disabled]="anchoring() || !perm.can('Documentos', 'crear')"
            class="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            <lucide-icon [img]="anchoring() ? LoaderIcon : LinkIcon" [class]="'w-4 h-4' + (anchoring() ? ' animate-spin' : '')" />
            {{ anchoring() ? 'Anclando…' : 'Anclar documento' }}
          </button>
        </div>
      }

    </div>
  `,
})
export class AnclarCasoDialogComponent implements OnInit {
  private readonly casosService = inject(CasosService);
  private readonly casoDocService = inject(CasoDocService);
  private readonly docGenerationService = inject(DocGenerationService);
  private readonly toast = inject(ToastService);
  readonly perm = inject(PermissionService);

  readonly template = input.required<DocTemplate>();
  readonly values = input.required<Record<string, string>>();
  readonly renderedHtml = input.required<string>();
  readonly close = output<void>();
  readonly anchored = output<string>();

  readonly XIcon = X;
  readonly SearchIcon = Search;
  readonly FolderIcon = Folder;
  readonly FolderOpenIcon = FolderOpen;
  readonly ChevronRightIcon = ChevronRight;
  readonly CheckIcon = Check;
  readonly LoaderIcon = Loader;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly LinkIcon = Link;

  readonly step = signal<Step>('search');
  readonly search = signal('');
  readonly loadingCasos = signal(false);
  readonly selectedCaso = signal<Caso | null>(null);
  readonly folders = signal<CasoDocFolder[]>([]);
  readonly loadingFolders = signal(false);
  readonly selectedFolderId = signal<string | null>(null);
  readonly anchoring = signal(false);

  readonly filteredCasos = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.casosService.casos().filter(c =>
      !q || c.titulo.toLowerCase().includes(q)
    );
  });

  readonly requiredPending = computed(() => {
    const t = this.template();
    const vals = this.values();
    return t.variables.filter(v => v.required && !(vals[v.key] ?? '').trim()).length;
  });

  readonly folderTree = computed(() => {
    const folders = this.folders();
    const byId = new Map(folders.map(f => [f.id, f]));

    const depth = (f: CasoDocFolder): number => {
      if (!f.parentId) return 0;
      const parent = byId.get(f.parentId);
      return parent ? 1 + depth(parent) : 0;
    };

    const fullPath = (f: CasoDocFolder): string => {
      if (!f.parentId) return f.name;
      const parent = byId.get(f.parentId);
      return parent ? `${fullPath(parent)} / ${f.name}` : f.name;
    };

    return folders
      .map(f => ({ ...f, depth: depth(f), fullPath: fullPath(f) }))
      .sort((a, b) => a.fullPath.localeCompare(b.fullPath));
  });

  folderById(id: string): CasoDocFolder | undefined {
    return this.folders().find(f => f.id === id);
  }

  estadoColor(estado: string): string {
    switch (estado) {
      case 'en_proceso': return '#22c55e';
      case 'urgente': return '#ef4444';
      case 'cerrado': return '#94a3b8';
      case 'archivado': return '#cbd5e1';
      default: return '#f59e0b';
    }
  }

  async ngOnInit(): Promise<void> {
    this.loadingCasos.set(true);
    try {
      await this.casosService.loadCasos();
    } finally {
      this.loadingCasos.set(false);
    }
  }

  async selectCaso(caso: Caso): Promise<void> {
    this.selectedCaso.set(caso);
    this.selectedFolderId.set(null);
    this.step.set('folder');
    this.loadingFolders.set(true);
    try {
      const folders = await this.casoDocService.getFolders(caso.id);
      this.folders.set(folders);
    } finally {
      this.loadingFolders.set(false);
    }
  }

  goBack(): void {
    this.step.set('search');
    this.selectedCaso.set(null);
    this.folders.set([]);
    this.selectedFolderId.set(null);
  }

  async anchor(): Promise<void> {
    const caso = this.selectedCaso();
    const t = this.template();
    if (!caso || !t || this.anchoring()) return;
    // Igual que editar/eliminar la plantilla en doc-template-detail.ts: anclar
    // un documento a un caso también requiere la capacidad 'Documentos'/'crear',
    // no solo poder VER la plantilla.
    if (!this.perm.can('Documentos', 'crear')) return;

    this.anchoring.set(true);
    try {
      const docxBlob = await this.docGenerationService.generateDocxBlob(this.renderedHtml(), t.name);

      await this.toast.run(
        () => this.casoDocService.anclarPlantilla(
          caso.id,
          {
            name: t.name,
            docTemplateId: t.id,
            folderId: this.selectedFolderId(),
            generatedHtml: this.renderedHtml(),
            generatedValues: this.values(),
          },
          docxBlob
        ),
        {
          successMessage: `Documento anclado al caso "${caso.titulo}"`,
          errorTitle: 'No se pudo anclar el documento',
          onSuccess: () => this.anchored.emit(caso.id),
        }
      );
    } finally {
      this.anchoring.set(false);
    }
  }
}
