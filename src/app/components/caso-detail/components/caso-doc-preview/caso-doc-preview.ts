import {
  Component, ChangeDetectionStrategy, input, output, computed, inject,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideAngularModule, X, Download, FileQuestion } from 'lucide-angular';

// Documento previsualizable: cualquier cosa con URL y mimeType, venga de un
// slot requerido o de un archivo libre.
export interface PreviewDoc {
  name: string;
  downloadUrl: string;
  mimeType?: string;
}

@Component({
  selector: 'app-caso-doc-preview',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4',
    '(click)': 'onBackdrop($event)',
  },
  template: `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden" (click)="$event.stopPropagation()">

      <!-- Header -->
      <div class="flex items-center gap-3 px-5 py-3 border-b border-slate-200 shrink-0">
        <p class="flex-1 text-sm font-medium text-slate-700 truncate">{{ docu().name }}</p>
        <a
          [href]="docu().downloadUrl"
          target="_blank"
          rel="noopener"
          download
          class="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          aria-label="Descargar"
        >
          <lucide-icon [img]="DownloadIcon" class="w-4 h-4" />
        </a>
        <button
          (click)="close.emit()"
          class="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          aria-label="Cerrar previsualización"
        >
          <lucide-icon [img]="XIcon" class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 min-h-0 bg-slate-50">
        @switch (kind()) {
          @case ('pdf') {
            <iframe
              [src]="safeUrl()"
              class="w-full h-full border-0"
              [title]="docu().name"
            ></iframe>
          }
          @case ('image') {
            <div class="w-full h-full flex items-center justify-center p-4">
              <img [src]="docu().downloadUrl" [alt]="docu().name" class="max-w-full max-h-full object-contain rounded-lg" />
            </div>
          }
          @default {
            <div class="w-full h-full flex flex-col items-center justify-center gap-3 text-center p-6">
              <lucide-icon [img]="FileQuestionIcon" class="w-12 h-12 text-slate-300" />
              <p class="text-slate-500 text-sm font-medium">No hay vista previa para este tipo de archivo</p>
              <a
                [href]="docu().downloadUrl"
                target="_blank"
                rel="noopener"
                download
                class="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700"
              >
                <lucide-icon [img]="DownloadIcon" class="w-4 h-4" />
                Descargar
              </a>
            </div>
          }
        }
      </div>

    </div>
  `,
})
export class CasoDocPreviewComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly docu = input.required<PreviewDoc>();
  readonly close = output<void>();

  readonly XIcon = X;
  readonly DownloadIcon = Download;
  readonly FileQuestionIcon = FileQuestion;

  readonly kind = computed<'pdf' | 'image' | 'other'>(() => {
    const mime = this.docu().mimeType ?? '';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('image/')) return 'image';
    return 'other';
  });

  // Las URLs de descarga vienen de NUESTRO Firebase Storage (https firmado),
  // por eso es seguro confiar en ellas para el src del iframe.
  readonly safeUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.docu().downloadUrl)
  );

  onBackdrop(_event: MouseEvent): void {
    this.close.emit();
  }
}
