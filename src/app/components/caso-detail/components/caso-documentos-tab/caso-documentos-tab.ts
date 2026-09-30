import {
  Component, ChangeDetectionStrategy, inject, input, output, signal, computed,
} from '@angular/core';
import {
  LucideAngularModule, Folder, FolderOpen, FolderPlus,
  Loader, Upload, Trash2, ChevronRight, Check, X, Lock,
} from 'lucide-angular';
import type { CasoDocSlot, CasoDocFolder, CasoDocFile } from '../../../../interfaces';
import type { DocVersionEntry } from '../../../../interfaces/doc-lifecycle.interface';
import { CasoDocService } from '../../../../core/services/caso-doc.service';
import { ClassifiedUrlService } from '../../../../core/services/classified-url.service';
import { DocAuditService } from '../../../../core/services/doc-audit.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FolderNavigation } from '../../../../core/documentos/folder-navigation';
import { CasoDocSlotRowComponent } from '../caso-doc-slot-row/caso-doc-slot-row';
import { CasoDocFileRowComponent } from '../caso-doc-file-row/caso-doc-file-row';
import { CasoDocsChecklistComponent } from '../caso-docs-checklist/caso-docs-checklist';
import { CasoDocPreviewComponent, PreviewDoc } from '../caso-doc-preview/caso-doc-preview';
import { CasoDocGeneradorComponent, GeneratedDocEvent } from '../caso-doc-generador/caso-doc-generador';
import { DocHistoryPanelComponent } from '../../../../shared/components/doc-history-panel/doc-history-panel';
import { DocAccessDrawerComponent, type DocAccessState } from '../../../../shared/components/doc-access-drawer/doc-access-drawer';

export interface DocUploadEvent {
  slot: CasoDocSlot;
  file: File;
}

export interface FreeUploadEvent {
  folderId: string | null;
  file: File;
  /** Solo Admin puede marcarlo; las rules lo enforcen además en servidor. */
  clasificado?: boolean;
}

export interface ReuploadEvent {
  file: CasoDocFile;
  newFile: File;
}

export interface CreateFolderEvent {
  parentId: string | null;
  name: string;
}

interface HistoryTarget {
  title: string;
  versions: DocVersionEntry[];
  parentPath: string;
}

interface AccessTarget {
  kind: 'file' | 'slot';
  id: string;
  title: string;
  clasificado: boolean;
  allowedUserIds: string[];
}

@Component({
  selector: 'app-caso-documentos-tab',
  host: { style: 'display: block' },
  imports: [
    LucideAngularModule, CasoDocSlotRowComponent, CasoDocFileRowComponent, CasoDocsChecklistComponent,
    CasoDocPreviewComponent, CasoDocGeneradorComponent, DocHistoryPanelComponent, DocAccessDrawerComponent,
  ],
  templateUrl: './caso-documentos-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoDocumentosTabComponent {
  // Solo para construir paths de auditoría, registrar view/download y
  // gestionar clasificados (acción admin directa, no pasa por el contenedor).
  private readonly casoDocService = inject(CasoDocService);
  private readonly classifiedUrl = inject(ClassifiedUrlService);
  private readonly docAudit = inject(DocAuditService);
  private readonly permissionService = inject(PermissionService);
  private readonly toast = inject(ToastService);

  readonly isAdmin = this.permissionService.isAdmin;

  readonly casoId = input.required<string>();
  readonly folders = input.required<CasoDocFolder[]>();
  readonly slots = input.required<CasoDocSlot[]>();
  readonly files = input.required<CasoDocFile[]>();
  readonly loading = input.required<boolean>();
  readonly uploadingSlotId = input.required<string | null>();
  readonly busy = input.required<boolean>();
  readonly progress = input.required<{ subidos: number; total: number } | null>();
  /** Datos del caso para pre-rellenar las variables del documento. */
  readonly casoContext = input<Record<string, string>>({});
  /** Gating de permisos (`Casos.editar`/`Casos.eliminar`): oculta subir/generar/crear vs. borrar. */
  readonly canEdit = input(true);
  readonly canDelete = input(true);

  readonly uploadSlot = output<DocUploadEvent>();
  readonly removeSlot = output<CasoDocSlot>();
  readonly uploadFile = output<FreeUploadEvent>();
  readonly reuploadFile = output<ReuploadEvent>();
  readonly deleteFile = output<CasoDocFile>();
  readonly createFolder = output<CreateFolderEvent>();
  readonly deleteFolder = output<string>();
  readonly generateDoc = output<GeneratedDocEvent>();

  readonly FolderIcon = Folder;
  readonly FolderOpenIcon = FolderOpen;
  readonly FolderPlusIcon = FolderPlus;
  readonly LoaderIcon = Loader;
  readonly UploadIcon = Upload;
  readonly Trash2Icon = Trash2;
  readonly ChevronRightIcon = ChevronRight;
  readonly CheckIcon = Check;
  readonly XIcon = X;
  readonly LockIcon = Lock;

  // ── Estado de navegación (UI local) ────────────────────
  private readonly nav = new FolderNavigation<CasoDocFolder>();
  readonly currentFolderId = this.nav.currentFolderId;
  readonly folderPath = this.nav.path;
  readonly isCreatingFolder = signal(false);
  readonly newFolderName = signal('');
  readonly confirmingDeleteFolderId = signal<string | null>(null);
  readonly confirmingDeleteFileId = signal<string | null>(null);
  readonly preview = signal<PreviewDoc | null>(null);
  // Solo guardamos el id: el slot en sí se deriva en vivo de `slots()` (input
  // reactivo) más abajo, para no quedarnos con una copia estática mientras el
  // diálogo está abierto. Si otro usuario edita el mismo slot mientras tanto,
  // `generatingSlot` refleja el cambio en lugar de perderlo al guardar (lost update).
  readonly generatingSlotId = signal<string | null>(null);
  readonly generatingSlot = computed(() => {
    const id = this.generatingSlotId();
    return id ? (this.slots().find(s => s.id === id) ?? null) : null;
  });
  readonly historyTarget = signal<HistoryTarget | null>(null);
  readonly accessTarget = signal<AccessTarget | null>(null);
  readonly accessSaving = signal(false);
  /** Toggle admin: la próxima subida libre se marca como clasificada. */
  readonly uploadClassified = signal(false);

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
    this.nav.open(folder);
    this.resetTransient();
  }

  navigateToRoot(): void {
    this.nav.toRoot();
    this.resetTransient();
  }

  navigateToBreadcrumb(index: number): void {
    this.nav.toBreadcrumb(index);
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
  /** Abre el selector de archivo de la fila de un slot (lo usa el salto desde el checklist). */
  triggerSlotUpload(slotId: string): void {
    const el = document.getElementById(`upload-slot-${slotId}`) as HTMLInputElement | null;
    el?.click();
  }

  // ── Archivos libres ────────────────────────────────────
  triggerFreeUpload(): void {
    const el = document.getElementById('upload-free') as HTMLInputElement | null;
    el?.click();
  }

  triggerFolderUpload(): void {
    const el = document.getElementById('upload-folder') as HTMLInputElement | null;
    el?.click();
  }

  onFreeFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.emitFreeUploads(target.files);
    target.value = '';
  }

  /** Todos los archivos de la carpeta elegida se suben planos a la carpeta actual del caso. */
  onFolderSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.emitFreeUploads(target.files);
    target.value = '';
  }

  private emitFreeUploads(files: FileList | null): void {
    if (!files || files.length === 0) return;
    const clasificado = this.isAdmin() && this.uploadClassified();
    const folderId = this.currentFolderId();
    for (const file of Array.from(files)) {
      this.uploadFile.emit({ folderId, file, clasificado });
    }
    this.uploadClassified.set(false);
  }

  // ── Clasificados (solo Admin) ──────────────────────────
  openFileAccess(file: CasoDocFile): void {
    this.accessTarget.set({
      kind: 'file',
      id: file.id,
      title: file.name,
      clasificado: file.clasificado === true,
      allowedUserIds: file.allowedUserIds ?? [],
    });
  }

  openSlotAccess(slot: CasoDocSlot): void {
    this.accessTarget.set({
      kind: 'slot',
      id: slot.id,
      title: slot.name,
      clasificado: slot.clasificado === true,
      allowedUserIds: slot.allowedUserIds ?? [],
    });
  }

  async onAccessSaved(state: DocAccessState): Promise<void> {
    const target = this.accessTarget();
    if (!target) return;
    this.accessSaving.set(true);
    try {
      await this.toast.run(
        () => target.kind === 'file'
          ? this.casoDocService.setFileClassification(this.casoId(), target.id, state.restricted, state.allowedUserIds)
          : this.casoDocService.setSlotClassification(this.casoId(), target.id, state.restricted, state.allowedUserIds),
        {
          successMessage: 'Acceso actualizado',
          errorTitle: 'No se pudo actualizar el acceso',
          onSuccess: () => this.accessTarget.set(null),
        },
      );
    } finally {
      this.accessSaving.set(false);
    }
  }

  requestDeleteFile(fileId: string): void {
    this.confirmingDeleteFileId.set(fileId);
  }

  confirmDeleteFile(file: CasoDocFile): void {
    this.deleteFile.emit(file);
    this.confirmingDeleteFileId.set(null);
  }

  // ── Historial y auditoría ──────────────────────────────
  openFileHistory(file: CasoDocFile): void {
    this.historyTarget.set({
      title: file.name,
      versions: file.versions ?? [],
      parentPath: this.casoDocService.filePath(this.casoId(), file.id),
    });
  }

  openSlotHistory(slot: CasoDocSlot): void {
    this.historyTarget.set({
      title: slot.name,
      versions: slot.versions ?? [],
      parentPath: this.casoDocService.slotPath(this.casoId(), slot.id),
    });
  }

  closeHistory(): void {
    this.historyTarget.set(null);
  }

  /**
   * Preview de archivo libre, dejando rastro en la auditoría. Los clasificados
   * no tienen downloadUrl: la callable valida el acceso, audita en servidor y
   * devuelve una URL firmada de 5 minutos.
   */
  async previewFile(file: CasoDocFile): Promise<void> {
    if (file.clasificado === true) {
      const url = await this.toast.run(
        () => this.classifiedUrl.getUrl(this.casoDocService.filePath(this.casoId(), file.id), 'view'),
        { errorTitle: 'No se pudo abrir el documento clasificado' },
      );
      if (url) this.openPreview({ name: file.name, downloadUrl: url, mimeType: file.mimeType });
      return;
    }
    this.docAudit.log(this.casoDocService.filePath(this.casoId(), file.id), 'view', {
      version: file.version,
      detail: file.name,
    });
    this.openPreview({ name: file.name, downloadUrl: file.downloadUrl, mimeType: file.mimeType });
  }

  /** Preview del archivo de un slot, dejando rastro en la auditoría. */
  async previewSlot(slot: CasoDocSlot): Promise<void> {
    if (slot.clasificado === true && slot.storagePath) {
      const url = await this.toast.run(
        () => this.classifiedUrl.getUrl(this.casoDocService.slotPath(this.casoId(), slot.id), 'view'),
        { errorTitle: 'No se pudo abrir el documento clasificado' },
      );
      if (url) this.openPreview({ name: slot.name, downloadUrl: url, mimeType: slot.mimeType });
      return;
    }
    if (!slot.downloadUrl) return;
    this.docAudit.log(this.casoDocService.slotPath(this.casoId(), slot.id), 'view', {
      version: slot.version,
      detail: slot.name,
    });
    this.openPreview({ name: slot.name, downloadUrl: slot.downloadUrl, mimeType: slot.mimeType });
  }

  logFileDownload(file: CasoDocFile): void {
    this.docAudit.log(this.casoDocService.filePath(this.casoId(), file.id), 'download', {
      version: file.version,
      detail: file.name,
    });
  }

  /** Descarga de un clasificado: URL firmada vía callable (auditada en servidor). */
  async downloadClassifiedFile(file: CasoDocFile): Promise<void> {
    const url = await this.toast.run(
      () => this.classifiedUrl.getUrl(this.casoDocService.filePath(this.casoId(), file.id), 'download'),
      { errorTitle: 'No se pudo descargar el documento clasificado' },
    );
    if (url) window.open(url, '_blank', 'noopener');
  }

  // ── Preview ────────────────────────────────────────────
  openPreview(docu: PreviewDoc): void {
    this.preview.set(docu);
  }

  closePreview(): void {
    this.preview.set(null);
  }

  // ── Documento generado desde plantilla ─────────────────
  openGenerador(slot: CasoDocSlot): void {
    this.generatingSlotId.set(slot.id);
  }

  closeGenerador(): void {
    this.generatingSlotId.set(null);
  }

  onGenerated(event: GeneratedDocEvent): void {
    this.generateDoc.emit(event);
    this.generatingSlotId.set(null);
  }

  // ── Panel lateral ──────────────────────────────────────
  jumpToSlot(slot: CasoDocSlot): void {
    if (!slot.folderId) {
      this.navigateToRoot();
    } else {
      this.nav.goTo(slot.folderId, this.folders());
      this.resetTransient();
    }
    if (slot.docTemplateId) {
      this.generatingSlotId.set(slot.id);
    } else {
      setTimeout(() => this.triggerSlotUpload(slot.id), 50);
    }
  }
}
