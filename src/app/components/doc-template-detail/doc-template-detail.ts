import { Component, OnInit, ChangeDetectionStrategy, inject, input, signal, computed } from '@angular/core';
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
} from 'lucide-angular';
import { DocTemplateService } from '../../core/services/doc-template.service';
import { DocGenerationService } from '../../core/services/doc-generation.service';
import type { DocTemplate, TemplateVariable } from '../../interfaces';

@Component({
  selector: 'app-doc-template-detail',
  imports: [LucideAngularModule],
  templateUrl: './doc-template-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocTemplateDetailComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly templateService = inject(DocTemplateService);
  private readonly generationService = inject(DocGenerationService);

  readonly id = input.required<string>();

  readonly ArrowLeftIcon = ArrowLeft;
  readonly CopyIcon = Copy;
  readonly CheckIcon = Check;
  readonly DownloadIcon = Download;
  readonly SparklesIcon = Sparkles;
  readonly FileTextIcon = FileText;
  readonly Trash2Icon = Trash2;

  readonly template = signal<DocTemplate | null>(null);
  readonly loading = signal(true);
  readonly values = signal<Record<string, string>>({});
  readonly copied = signal(false);
  readonly downloading = signal(false);
  readonly confirmingDelete = signal(false);

  readonly rendered = computed(() => {
    const t = this.template();
    return t ? this.generationService.interpolateForPreview(t.html, this.values()) : '';
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
    } finally {
      this.loading.set(false);
    }
  }

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
    if (!t) return;
    await this.templateService.deleteTemplate(t.id);
    this.goBack();
  }

  goBack(): void {
    this.router.navigate(['/documentos']);
  }
}
