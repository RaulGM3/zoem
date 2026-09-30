import { Component, ChangeDetectionStrategy, ElementRef, input, output, viewChild } from '@angular/core';
import {
  LucideAngularModule, CheckCircle2, FileText, FilePen, Loader, Upload, Trash2, Eye, History, Lock,
} from 'lucide-angular';
import type { CasoDocSlot } from '../../../../interfaces';

/**
 * Fila de un documento requerido por la plantilla (slot) en la pestaña de
 * documentos del caso. Presentacional: solo avisa de la acción elegida.
 */
@Component({
  selector: 'app-caso-doc-slot-row',
  host: { class: 'block' },
  imports: [LucideAngularModule],
  templateUrl: './caso-doc-slot-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoDocSlotRowComponent {
  readonly slot = input.required<CasoDocSlot>();
  readonly canEdit = input(true);
  readonly canDelete = input(true);
  readonly isAdmin = input(false);
  /** El slot tiene una subida o un borrado en curso. */
  readonly uploading = input(false);

  /** Abrir el generador: rellenar un slot con plantilla o ver el ya generado. */
  readonly generate = output<void>();
  readonly upload = output<File>();
  readonly preview = output<void>();
  readonly history = output<void>();
  readonly access = output<void>();
  readonly remove = output<void>();

  readonly CheckCircle2Icon = CheckCircle2;
  readonly FileTextIcon = FileText;
  readonly FilePenIcon = FilePen;
  readonly LoaderIcon = Loader;
  readonly UploadIcon = Upload;
  readonly Trash2Icon = Trash2;
  readonly EyeIcon = Eye;
  readonly HistoryIcon = History;
  readonly LockIcon = Lock;

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  triggerUpload(): void {
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) this.upload.emit(file);
    target.value = '';
  }
}
