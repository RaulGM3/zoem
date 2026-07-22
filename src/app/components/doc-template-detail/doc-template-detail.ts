import { Component, OnInit, ChangeDetectionStrategy, ViewChild, ElementRef, inject, input, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  ArrowLeft,
  Copy,
  Check,
  Download,
  Sparkles,
  FileText,
  Trash2,
  Pencil,
  Tag,
  Lock,
  X,
  Link,
} from 'lucide-angular';
import { AnclarCasoDialogComponent } from './anclar-caso-dialog/anclar-caso-dialog';
import { DocTemplateService } from '../../core/services/doc-template.service';
import { ToastService } from '../../core/services/toast.service';
import { PermissionService } from '../../core/services/permission.service';
import { FocusTrapDirective } from '../../shared/directives/focus-trap.directive';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const VAR_KEY_PATTERN = /^[a-zA-Z0-9_]+$/;

import { DocGenerationService } from '../../core/services/doc-generation.service';
import type { DocTemplate, TemplateVariable } from '../../interfaces';

@Component({
  selector: 'app-doc-template-detail',
  imports: [LucideAngularModule, AnclarCasoDialogComponent, FocusTrapDirective],
  templateUrl: './doc-template-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocTemplateDetailComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly templateService = inject(DocTemplateService);
  private readonly toast = inject(ToastService);
  readonly perm = inject(PermissionService);
  protected readonly generationService = inject(DocGenerationService);
  @ViewChild('previewContent') private readonly previewContent?: ElementRef<HTMLElement>;

  readonly id = input.required<string>();

  readonly ArrowLeftIcon = ArrowLeft;
  readonly CopyIcon = Copy;
  readonly CheckIcon = Check;
  readonly DownloadIcon = Download;
  readonly SparklesIcon = Sparkles;
  readonly FileTextIcon = FileText;
  readonly Trash2Icon = Trash2;
  readonly PencilIcon = Pencil;
  readonly TagIcon = Tag;
  readonly LockIcon = Lock;
  readonly XIcon = X;
  readonly LinkIcon = Link;

  readonly showAnclarDialog = signal(false);

  readonly template = signal<DocTemplate | null>(null);
  readonly loading = signal(true);
  readonly values = signal<Record<string, string>>({});
  readonly copied = signal(false);
  readonly downloading = signal(false);
  readonly confirmingDelete = signal(false);
  readonly editMode = signal(false);
  readonly pendingSelection = signal('');
  readonly showNewVarForm = signal(false);
  readonly newVarKey = signal('');
  readonly newVarLabel = signal('');
  readonly makeStaticFor = signal<string | null>(null);
  readonly makeStaticValue = signal('');
  readonly saving = signal(false);
  readonly focusedVar = signal<string | null>(null);

  constructor() {
    effect(() => {
      const key = this.focusedVar();
      if (!key) return;
      setTimeout(() => {
        const container = this.previewContent?.nativeElement;
        if (!container) return;
        const mark = container.querySelector<HTMLElement>(`[data-var-key="${key}"]`);
        mark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    });
  }

  readonly rendered = computed(() => {
    const t = this.template();
    const focused = this.focusedVar();
    const vals = this.values();
    if (!t) return '';
    return t.html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      const value = vals[key];
      const isFocused = focused === key;
      const baseClass = isFocused
        ? 'rounded px-0.5 bg-violet-200 text-violet-900 ring-2 ring-violet-400'
        : value
          ? 'rounded bg-emerald-100 px-0.5 text-emerald-800'
          : 'rounded bg-amber-100 px-0.5 text-amber-800';
      const text = value ? escapeHtml(value) : `{{${key}}}`;
      return `<mark data-var-key="${key}" class="${baseClass}">${text}</mark>`;
    });
  });

  readonly renderedForEdit = computed(() => {
    const t = this.template();
    if (!t) return '';
    return t.html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
      `<span class="bg-violet-100 text-violet-700 rounded px-0.5 font-mono text-xs" data-var-key="${key}">{{${key}}}</span>`
    );
  });

  readonly filledCount = computed(() => {
    const t = this.template();
    if (!t) return 0;
    const values = this.values();
    return t.variables.filter(v => (values[v.key] ?? '').trim()).length;
  });

  readonly requiredPending = computed(() => {
    const t = this.template();
    if (!t) return 0;
    const values = this.values();
    return t.variables.filter(v => v.required && !(values[v.key] ?? '').trim()).length;
  });

  async ngOnInit(): Promise<void> {
    try {
      const template = await this.templateService.getTemplate(this.id());
      this.template.set(template);
    } catch {
      // Los rules de Firestore niegan el `get` a usuarios no-super cuando la
      // plantilla está soft-deleted, antes de que getTemplate() aplique su
      // propio filtro. Tratamos cualquier error como "no encontrada" en vez
      // de dejar la promesa rechazada sin manejar.
      this.template.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  setValue(key: string, value: string): void {
    this.values.update(v => ({ ...v, [key]: value }));
  }

  onVarFocus(key: string): void {
    this.focusedVar.set(key);
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

  async copy(): Promise<void> {
    const t = this.template();
    if (!t) return;
    const html = this.generationService.interpolate(t.html, this.values());
    await this.generationService.copyToClipboard(html);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async download(): Promise<void> {
    const t = this.template();
    if (!t || this.downloading()) return;
    this.downloading.set(true);
    try {
      const html = this.generationService.interpolate(t.html, this.values());
      await this.generationService.downloadAsDocx(html, t.name);
    } finally {
      this.downloading.set(false);
    }
  }

  async deleteTemplate(): Promise<void> {
    const t = this.template();
    if (!t || !this.perm.can('Documentos', 'eliminar')) return;
    await this.toast.run(() => this.templateService.deleteTemplate(t.id), {
      successMessage: 'Plantilla eliminada',
      errorTitle: 'No se pudo eliminar la plantilla',
      onSuccess: () => this.goBack(),
    });
  }

  toggleEditMode(): void {
    if (!this.perm.can('Documentos', 'editar')) return;
    this.editMode.update(v => !v);
    if (!this.editMode()) {
      this.cancelNewVar();
      this.makeStaticFor.set(null);
    }
  }

  onPreviewMouseUp(): void {
    if (!this.editMode()) return;
    const text = window.getSelection()?.toString().trim() ?? '';
    if (text) {
      this.pendingSelection.set(text);
      this.showNewVarForm.set(true);
    }
  }

  cancelNewVar(): void {
    this.showNewVarForm.set(false);
    this.pendingSelection.set('');
    this.newVarKey.set('');
    this.newVarLabel.set('');
    window.getSelection()?.removeAllRanges();
  }

  async promoteToVariable(): Promise<void> {
    const t = this.template();
    const text = this.pendingSelection();
    const key = this.newVarKey().trim();
    const label = this.newVarLabel().trim();
    if (!t || !text || !key || !label) return;
    if (!this.perm.can('Documentos', 'editar')) return;

    if (!VAR_KEY_PATTERN.test(key)) {
      this.toast.fromError(new Error('La clave solo puede contener letras, números y guiones bajos.'), {
        title: 'Clave de variable inválida',
      });
      return;
    }
    if (t.variables.some(v => v.key === key)) {
      this.toast.fromError(new Error(`Ya existe una variable con la clave "${key}".`), {
        title: 'Clave de variable duplicada',
      });
      return;
    }
    // window.getSelection() devuelve texto plano decodificado, pero el HTML
    // guardado puede tener el mismo texto con entidades (&amp;, &lt;, etc.) si
    // contiene caracteres especiales (ej: "Smith & Jones"). Si la comparación
    // en crudo falla, reintentamos contra la versión HTML-encodeada.
    const encodedText = escapeHtml(text);
    const matchText = t.html.includes(text) ? text : t.html.includes(encodedText) ? encodedText : null;
    if (matchText === null) {
      this.toast.fromError(new Error('El texto seleccionado no se encontró en el documento. Vuelve a seleccionarlo.'), {
        title: 'No se pudo crear la variable',
      });
      return;
    }

    const newHtml = t.html.split(matchText).join(`{{${key}}}`);
    const newVariables: TemplateVariable[] = [
      ...t.variables,
      { key, label, type: 'text', required: false },
    ];

    this.saving.set(true);
    try {
      await this.toast.run(
        () => this.templateService.updateTemplate(t.id, { html: newHtml, variables: newVariables }),
        {
          errorTitle: 'No se pudo crear la variable',
          onSuccess: () => {
            this.template.update(prev => prev ? { ...prev, html: newHtml, variables: newVariables } : prev);
            this.cancelNewVar();
          },
        }
      );
    } finally {
      this.saving.set(false);
    }
  }

  startDemote(variable: TemplateVariable): void {
    this.makeStaticFor.set(variable.key);
    this.makeStaticValue.set(variable.label);
  }

  cancelDemote(): void {
    this.makeStaticFor.set(null);
    this.makeStaticValue.set('');
  }

  async demoteToStatic(): Promise<void> {
    const t = this.template();
    const key = this.makeStaticFor();
    const value = this.makeStaticValue().trim();
    if (!t || !key) return;
    if (!this.perm.can('Documentos', 'editar')) return;

    const regex = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'g');
    const newHtml = t.html.replace(regex, value);
    const newVariables = t.variables.filter(v => v.key !== key);

    this.saving.set(true);
    try {
      await this.toast.run(
        () => this.templateService.updateTemplate(t.id, { html: newHtml, variables: newVariables }),
        {
          errorTitle: 'No se pudo convertir la variable',
          onSuccess: () => {
            this.template.update(prev => prev ? { ...prev, html: newHtml, variables: newVariables } : prev);
            this.cancelDemote();
          },
        }
      );
    } finally {
      this.saving.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/documentos']);
  }
}
