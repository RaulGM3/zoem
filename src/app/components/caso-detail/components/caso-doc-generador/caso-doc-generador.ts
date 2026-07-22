import {
  Component, ChangeDetectionStrategy, input, output, signal, computed, inject, effect, untracked,
} from '@angular/core';
import {
  LucideAngularModule, X, Copy, Check, Download, Loader, Save, Pencil, FileText,
} from 'lucide-angular';
import { DocTemplateService } from '../../../../core/services/doc-template.service';
import { DocGenerationService } from '../../../../core/services/doc-generation.service';
import type { CasoDocSlot, DocTemplate, TemplateVariable } from '../../../../interfaces';

export interface GeneratedDocEvent {
  slot: CasoDocSlot;
  html: string;
  values: Record<string, string>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Modal para rellenar la plantilla de documento vinculada a un slot del caso y
 * congelar el resultado. Si el slot ya está `generado`, abre en modo lectura
 * sobre el snapshot guardado, con opción de editar/regenerar.
 *
 * Carga el docTemplate por su cuenta (DocTemplateService) y resuelve copiar /
 * descargar .docx con DocGenerationService — ambas son operaciones de hoja. La
 * PERSISTENCIA del snapshot la delega hacia arriba vía el output `save`.
 */
@Component({
  selector: 'app-caso-doc-generador',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4',
    '(click)': 'close.emit()',
  },
  template: `
    <div
      class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden"
      (click)="$event.stopPropagation()"
    >
      <!-- Header -->
      <div class="flex items-center gap-3 px-5 py-3 border-b border-slate-200 shrink-0">
        <lucide-icon [img]="FileTextIcon" class="w-5 h-5 text-violet-500 shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-800 truncate">{{ slot().name }}</p>
          @if (template(); as t) {
            <p class="text-xs text-slate-400 truncate">{{ t.name }}</p>
          }
        </div>

        <button
          (click)="copy()"
          [disabled]="!template()"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <lucide-icon [img]="copied() ? CheckIcon : CopyIcon" class="w-3.5 h-3.5" />
          {{ copied() ? 'Copiado' : 'Copiar' }}
        </button>
        <button
          (click)="download()"
          [disabled]="!template() || downloading()"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <lucide-icon [img]="downloading() ? LoaderIcon : DownloadIcon" [class]="'w-3.5 h-3.5' + (downloading() ? ' animate-spin' : '')" />
          .docx
        </button>
        <button
          (click)="close.emit()"
          class="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          aria-label="Cerrar"
        >
          <lucide-icon [img]="XIcon" class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      @if (loading()) {
        <div class="flex-1 flex items-center justify-center text-slate-400 text-sm">
          <lucide-icon [img]="LoaderIcon" class="w-4 h-4 mr-2 animate-spin" />
          Cargando plantilla...
        </div>
      } @else if (!template()) {
        <div class="flex-1 flex items-center justify-center text-slate-400 text-sm">
          No se pudo cargar la plantilla de documento.
        </div>
      } @else {
        <div class="flex-1 min-h-0 flex">

          <!-- Formulario de variables (solo en modo edición) -->
          @if (editMode()) {
            <aside class="w-80 shrink-0 border-r border-slate-200 overflow-y-auto p-4 space-y-3 bg-slate-50">
              <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Rellenar variables
              </p>
              @for (v of template()!.variables; track v.key) {
                <div class="space-y-1">
                  <label [for]="'var-' + v.key" class="block text-xs font-medium text-slate-600">
                    {{ v.label }}
                    @if (v.required) { <span class="text-red-400">*</span> }
                  </label>
                  @if (v.type === 'textarea') {
                    <textarea
                      [id]="'var-' + v.key"
                      [value]="values()[v.key]"
                      (input)="setValue(v.key, $any($event.target).value)"
                      rows="3"
                      class="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
                    ></textarea>
                  } @else {
                    <input
                      [id]="'var-' + v.key"
                      [type]="inputType(v)"
                      [value]="values()[v.key]"
                      (input)="setValue(v.key, $any($event.target).value)"
                      class="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
                    />
                  }
                </div>
              } @empty {
                <p class="text-xs text-slate-400">Esta plantilla no tiene variables.</p>
              }
            </aside>
          }

          <!-- Preview del documento -->
          <div class="flex-1 min-h-0 overflow-y-auto p-6 bg-slate-100">
            <div
              class="mx-auto max-w-2xl bg-white rounded-lg shadow-sm p-8 text-sm leading-relaxed text-slate-800 **:max-w-full"
              [innerHTML]="previewHtml()"
            ></div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center gap-3 px-5 py-3 border-t border-slate-200 shrink-0 bg-white">
          @if (editMode()) {
            @if (requiredPending() > 0) {
              <span class="text-xs text-amber-600">
                {{ requiredPending() }} campo(s) obligatorio(s) sin rellenar
              </span>
            }
            <div class="flex-1"></div>
            @if (slot().status === 'generado') {
              <button
                (click)="cancelEdit()"
                class="px-4 py-2 text-sm text-slate-500 rounded-lg hover:bg-slate-100"
              >
                Cancelar
              </button>
            }
            @if (canEdit()) {
              <button
                (click)="save()"
                [disabled]="requiredPending() > 0 || saving()"
                class="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                <lucide-icon [img]="saving() ? LoaderIcon : SaveIcon" [class]="'w-4 h-4' + (saving() ? ' animate-spin' : '')" />
                Guardar documento
              </button>
            }
          } @else {
            <span class="text-xs text-emerald-600 flex items-center gap-1.5">
              <lucide-icon [img]="CheckIcon" class="w-3.5 h-3.5" />
              Documento congelado
            </span>
            <div class="flex-1"></div>
            @if (canEdit()) {
              <button
                (click)="startEdit()"
                class="flex items-center gap-1.5 px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                <lucide-icon [img]="PencilIcon" class="w-4 h-4" />
                Editar / regenerar
              </button>
            }
          }
        </div>
      }
    </div>
  `,
})
export class CasoDocGeneradorComponent {
  private readonly templateService = inject(DocTemplateService);
  private readonly generationService = inject(DocGenerationService);

  readonly slot = input.required<CasoDocSlot>();
  /** Datos del caso para pre-rellenar variables por heurística. */
  readonly casoContext = input<Record<string, string>>({});
  /** Gating de permisos (`Casos.editar`): oculta "Editar / regenerar" y "Guardar documento". */
  readonly canEdit = input(true);

  readonly save_ = output<GeneratedDocEvent>({ alias: 'save' });
  readonly close = output<void>();

  readonly XIcon = X;
  readonly CopyIcon = Copy;
  readonly CheckIcon = Check;
  readonly DownloadIcon = Download;
  readonly LoaderIcon = Loader;
  readonly SaveIcon = Save;
  readonly PencilIcon = Pencil;
  readonly FileTextIcon = FileText;

  readonly template = signal<DocTemplate | null>(null);
  readonly loading = signal(true);
  readonly values = signal<Record<string, string>>({});
  readonly editMode = signal(false);
  readonly copied = signal(false);
  readonly downloading = signal(false);
  readonly saving = signal(false);

  // Id del slot la última vez que se ejecutó el reset/reload de abajo. `slot()`
  // es un input reactivo que puede recibir una nueva referencia del mismo slot
  // (p.ej. `slots()` repoblado por motivos ajenos en el padre) sin que el
  // documento haya cambiado realmente. Comparar por id evita que esas
  // actualizaciones irrelevantes descarten una edición en curso del usuario.
  private previousSlotId: string | null = null;

  constructor() {
    effect(() => {
      const slot = this.slot();
      const idChanged = untracked(() => this.previousSlotId) !== slot.id;
      // Mismo slot (mismo id): no re-sembrar el formulario ni resetear el modo,
      // que descartaría una edición en curso del usuario sin motivo real.
      if (!idChanged) return;
      this.previousSlotId = slot.id;
      this.loading.set(true);
      // Un slot ya generado abre en modo lectura sobre su snapshot.
      this.editMode.set(slot.status !== 'generado');
      void this.loadTemplate(slot);
    });
  }

  private async loadTemplate(slot: CasoDocSlot): Promise<void> {
    if (!slot.docTemplateId) {
      this.loading.set(false);
      return;
    }
    try {
      const t = await this.templateService.getTemplate(slot.docTemplateId);
      this.template.set(t);
      if (t) {
        this.values.set(
          slot.generatedValues ?? this.prefill(t.variables, this.casoContext())
        );
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Pre-rellena por coincidencia laxa entre clave/etiqueta de la variable y el contexto del caso. */
  private prefill(variables: TemplateVariable[], context: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const v of variables) {
      const haystack = `${v.key} ${v.label ?? ''}`.toLowerCase();
      for (const [token, value] of Object.entries(context)) {
        if (value && haystack.includes(token)) {
          out[v.key] = value;
          break;
        }
      }
    }
    return out;
  }

  // HTML interpolado final (valores escapados sobre la plantilla de confianza).
  readonly renderedHtml = computed(() => {
    const t = this.template();
    if (!t) return '';
    return this.generationService.interpolate(t.html, this.values());
  });

  // En modo lectura mostramos el snapshot congelado tal cual se guardó.
  readonly previewHtml = computed(() => {
    if (!this.editMode()) {
      return this.slot().generatedHtml ?? this.renderedHtml();
    }
    const t = this.template();
    if (!t) return '';
    return this.generationService.interpolateForPreview(t.html, this.values());
  });

  readonly requiredPending = computed(() => {
    const t = this.template();
    if (!t) return 0;
    const vals = this.values();
    return t.variables.filter(v => v.required && !(vals[v.key] ?? '').trim()).length;
  });

  setValue(key: string, value: string): void {
    this.values.update(v => ({ ...v, [key]: value }));
  }

  inputType(variable: TemplateVariable): string {
    switch (variable.type) {
      case 'date': return 'date';
      case 'number':
      case 'currency': return 'number';
      case 'email': return 'email';
      default: return 'text';
    }
  }

  startEdit(): void {
    this.editMode.set(true);
  }

  cancelEdit(): void {
    // Volver a lectura sobre el snapshot; restaura los valores guardados.
    this.values.set(this.slot().generatedValues ?? {});
    this.editMode.set(false);
  }

  /** HTML "limpio" (sin marcas de preview) para copiar/descargar. */
  private currentCleanHtml(): string {
    if (!this.editMode()) {
      return this.slot().generatedHtml ?? this.renderedHtml();
    }
    return this.renderedHtml();
  }

  async copy(): Promise<void> {
    await this.generationService.copyToClipboard(this.currentCleanHtml());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async download(): Promise<void> {
    if (this.downloading()) return;
    this.downloading.set(true);
    try {
      await this.generationService.downloadAsDocx(this.currentCleanHtml(), this.slot().name);
    } finally {
      this.downloading.set(false);
    }
  }

  save(): void {
    if (this.requiredPending() > 0 || this.saving()) return;
    this.saving.set(true);
    this.save_.emit({
      slot: this.slot(),
      html: this.renderedHtml(),
      values: this.values(),
    });
  }
}
