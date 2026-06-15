import {
  Component, ChangeDetectionStrategy, input, output, signal, computed,
} from '@angular/core';
import {
  LucideAngularModule, CheckCircle2, FileText, Folder, FolderOpen, FolderPlus,
  Loader, Download, Upload, Trash2, ChevronRight, Eye, Check, X,
} from 'lucide-angular';
import type { CasoDocSlot, CasoDocFolder, CasoDocFile } from '../../../../interfaces';
import { CasoDocPreviewComponent, PreviewDoc } from '../caso-doc-preview/caso-doc-preview';

export interface DocUploadEvent {
  slot: CasoDocSlot;
  file: File;
}

export interface FreeUploadEvent {
  folderId: string | null;
  file: File;
}

export interface CreateFolderEvent {
  parentId: string | null;
  name: string;
}

@Component({
  selector: 'app-caso-documentos-tab',
  host: { style: 'display: block' },
  imports: [LucideAngularModule, CasoDocPreviewComponent],
  templateUrl: './caso-documentos-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoDocumentosTabComponent {
  readonly folders = input.required<CasoDocFolder[]>();
  readonly slots = input.required<CasoDocSlot[]>();
  readonly files = input.required<CasoDocFile[]>();
  readonly loading = input.required<boolean>();
  readonly uploadingSlotId = input.required<string | null>();
  readonly busy = input.required<boolean>();
  readonly progress = input.required<{ subidos: number; total: number } | null>();

  readonly uploadSlot = output<DocUploadEvent>();
  readonly removeSlot = output<CasoDocSlot>();
  readonly uploadFile = output<FreeUploadEvent>();
  readonly deleteFile = output<CasoDocFile>();
  readonly createFolder = output<CreateFolderEvent>();
  readonly deleteFolder = output<string>();

  readonly CheckCircle2Icon = CheckCircle2;
  readonly FileTextIcon = FileText;
  readonly FolderIcon = Folder;
  readonly FolderOpenIcon = FolderOpen;
  readonly FolderPlusIcon = FolderPlus;
  readonly LoaderIcon = Loader;
  readonly DownloadIcon = Download;
  readonly UploadIcon = Upload;
  readonly Trash2Icon = Trash2;
  readonly ChevronRightIcon = ChevronRight;
  readonly EyeIcon = Eye;
  readonly CheckIcon = Check;
  readonly XIcon = X;

  // ── Estado de navegación (UI local) ────────────────────
  readonly currentFolderId = signal<string | null>(null);
  readonly folderPath = signal<CasoDocFolder[]>([]);
  readonly isCreatingFolder = signal(false);
  readonly newFolderName = signal('');
  readonly confirmingDeleteFolderId = signal<string | null>(null);
  readonly confirmingDeleteFileId = signal<string | null>(null);
  readonly preview = signal<PreviewDoc | null>(null);

  // ── Vistas derivadas del nivel actual ──────────────────
  readonly currentFolders = computed(() =>
    this.folders().filter(f => f.parentId === this.currentFolderId())
  );
  readonly currentSlots = computed(() =>
    this.slots().filter(s => s.folderId === this.currentFolderId())
  );
  readonly currentFiles = computed(() =>
    this.files().filter(f => f.folderId === this.currentFolderId())
  );
  readonly isEmptyHere = computed(() =>
    this.currentFolders().length === 0
    && this.currentSlots().length === 0
    && this.currentFiles().length === 0
  );

  // ── Navegación ─────────────────────────────────────────
  openFolder(folder: CasoDocFolder): void {
    this.currentFolderId.set(folder.id);
    this.folderPath.update(path => [...path, folder]);
    this.resetTransient();
  }

  navigateToRoot(): void {
    this.currentFolderId.set(null);
    this.folderPath.set([]);
    this.resetTransient();
  }

  navigateToBreadcrumb(index: number): void {
    const path = this.folderPath();
    this.currentFolderId.set(path[index].id);
    this.folderPath.set(path.slice(0, index + 1));
    this.resetTransient();
  }

  private resetTransient(): void {
    this.isCreatingFolder.set(false);
    this.newFolderName.set('');
    this.confirmingDeleteFolderId.set(null);
    this.confirmingDeleteFileId.set(null);
  }

  // ── Carpetas ───────────────────────────────────────────
  startCreateFolder(): void {
    this.isCreatingFolder.set(true);
    this.newFolderName.set('');
  }

  confirmCreateFolder(): void {
    const name = this.newFolderName().trim();
    if (!name) return;
    this.createFolder.emit({ parentId: this.currentFolderId(), name });
    this.isCreatingFolder.set(false);
    this.newFolderName.set('');
  }

  cancelCreateFolder(): void {
    this.isCreatingFolder.set(false);
    this.newFolderName.set('');
  }

  requestDeleteFolder(folderId: string): void {
    this.confirmingDeleteFolderId.set(folderId);
  }

  confirmDeleteFolder(folderId: string): void {
    this.deleteFolder.emit(folderId);
    this.confirmingDeleteFolderId.set(null);
  }

  // ── Slots requeridos ───────────────────────────────────
  triggerSlotUpload(slotId: string): void {
    const el = document.getElementById(`upload-slot-${slotId}`) as HTMLInputElement | null;
    el?.click();
  }

  onSlotFileSelected(event: Event, slot: CasoDocSlot): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) this.uploadSlot.emit({ slot, file });
    target.value = '';
  }

  // ── Archivos libres ────────────────────────────────────
  triggerFreeUpload(): void {
    const el = document.getElementById('upload-free') as HTMLInputElement | null;
    el?.click();
  }

  onFreeFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) this.uploadFile.emit({ folderId: this.currentFolderId(), file });
    target.value = '';
  }

  requestDeleteFile(fileId: string): void {
    this.confirmingDeleteFileId.set(fileId);
  }

  confirmDeleteFile(file: CasoDocFile): void {
    this.deleteFile.emit(file);
    this.confirmingDeleteFileId.set(null);
  }

  // ── Preview ────────────────────────────────────────────
  openPreview(docu: PreviewDoc): void {
    this.preview.set(docu);
  }

  closePreview(): void {
    this.preview.set(null);
  }

  // ── Helpers ────────────────────────────────────────────
  formatFileSize(bytes: number | undefined): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
