import { Component, ChangeDetectionStrategy, inject, output, signal, computed } from '@angular/core';
import {
  LucideAngularModule,
  X,
  Upload,
  FileText,
  Sparkles,
  Trash2,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-angular';
import { DocExtractionService } from '../../../../core/services/doc-extraction.service';
import { DocTemplateService } from '../../../../core/services/doc-template.service';
import { FocusTrapDirective } from '../../../../shared/directives/focus-trap.directive';
import type { TemplateVariable, TemplateVariableType } from '../../../../interfaces';

type DrawerStep = 'upload' | 'procesando' | 'revision' | 'error';

@Component({
  selector: 'app-nueva-plantilla-drawer',
  imports: [LucideAngularModule, FocusTrapDirective],
  templateUrl: './nueva-plantilla-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NuevaPlantillaDrawerComponent {
  private readonly extractionService = inject(DocExtractionService);
  private readonly templateService = inject(DocTemplateService);

  readonly saved = output<string>();
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly UploadIcon = Upload;
  readonly FileTextIcon = FileText;
  readonly SparklesIcon = Sparkles;
  readonly Trash2Icon = Trash2;
  readonly TriangleAlertIcon = TriangleAlert;
  readonly ChevronDownIcon = ChevronDown;
  readonly ChevronUpIcon = ChevronUp;
  readonly ArrowLeftIcon = ArrowLeft;

  readonly tiposVariable: { value: TemplateVariableType; label: string }[] = [
    { value: 'text', label: 'Texto' },
    { value: 'textarea', label: 'Texto largo' },
    { value: 'date', label: 'Fecha' },
    { value: 'number', label: 'Número' },
    { value: 'currency', label: 'Importe (€)' },
    { value: 'email', label: 'Email' },
  ];

  readonly step = signal<DrawerStep>('upload');
  readonly file = signal<File | null>(null);
  readonly formName = signal('');
  readonly formDescripcion = signal('');
  readonly errorMessage = signal('');
  readonly saving = signal(false);
  readonly isDragging = signal(false);
  readonly showPreview = signal(false);

  readonly extractedHtml = signal('');
  readonly variables = signal<TemplateVariable[]>([]);

  readonly canProcess = computed(() => this.file() !== null && this.formName().trim().length > 0);
  readonly canSave = computed(() =>
    this.formName().trim().length > 0 && this.extractedHtml().trim().length > 0 && this.variables().length > 0
  );

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setFile(file);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  private setFile(file: File): void {
    this.errorMessage.set('');
    this.file.set(file);
    if (!this.formName().trim()) {
      this.formName.set(file.name.replace(/\.(pdf|docx?|doc)$/i, ''));
    }
  }

  async procesar(): Promise<void> {
    const file = this.file();
    if (!file) return;
    this.step.set('procesando');
    this.errorMessage.set('');
    try {
      const { html, variables } = await this.extractionService.extractFromFile(file);
      this.extractedHtml.set(html);
      this.variables.set(variables);
      this.step.set('revision');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error inesperado al analizar el documento.');
      this.step.set('error');
    }
  }

  retry(): void {
    this.step.set('upload');
    this.errorMessage.set('');
  }

  updateVariable(index: number, patch: Partial<TemplateVariable>): void {
    this.variables.update(list => list.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  removeVariable(index: number): void {
    this.variables.update(list => list.filter((_, i) => i !== index));
  }

  async guardar(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    try {
      const id = await this.templateService.createTemplate({
        name: this.formName().trim(),
        description: this.formDescripcion().trim() || undefined,
        html: this.extractedHtml(),
        variables: this.variables(),
        sourceFile: this.file() ?? undefined,
      });
      this.saved.emit(id);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'No se pudo guardar la plantilla.');
    } finally {
      this.saving.set(false);
    }
  }
}
