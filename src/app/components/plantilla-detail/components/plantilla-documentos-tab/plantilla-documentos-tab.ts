import { Component, ChangeDetectionStrategy, computed, inject, input, signal } from '@angular/core';
import {
  LucideAngularModule,
  X, Trash2, Pencil, FolderPlus, FilePlus, Folder, FolderOpen, Check, File, ArrowLeft as ArrowLeftSmall,
  Link2, Search, Lock,
} from 'lucide-angular';
import { ToastService } from '../../../../core/services/toast.service';
import { PlantillaFolderService } from '../../../../core/services/plantilla-folder.service';
import { PlantillaFileService } from '../../../../core/services/plantilla-file.service';
import { DocTemplateService } from '../../../../core/services/doc-template.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { FolderNavigation } from '../../../../core/documentos/folder-navigation';
import type { PlantillaFolder, PlantillaFile } from '../../../../interfaces';
import { DocAccessDrawerComponent, type DocAccessState } from '../../../../shared/components/doc-access-drawer/doc-access-drawer';

/**
 * Pestaña "Documentos de referencia" de una plantilla de caso: árbol de
 * carpetas con los documentos requeridos, su vínculo a plantillas de documento
 * y su visibilidad. La carga de carpetas y archivos la dispara el padre.
 */
@Component({
  selector: 'app-plantilla-documentos-tab',
  imports: [LucideAngularModule, DocAccessDrawerComponent],
  templateUrl: './plantilla-documentos-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class PlantillaDocumentosTabComponent {
  readonly plantillaId = input.required<string>();

  private readonly toast = inject(ToastService);
  readonly folderService = inject(PlantillaFolderService);
  readonly fileService = inject(PlantillaFileService);
  readonly docTemplateService = inject(DocTemplateService);
  private readonly permissionService = inject(PermissionService);

  readonly isAdmin = this.permissionService.isAdmin;

  readonly XIcon = X;
  readonly Trash2Icon = Trash2;
  readonly PencilIcon = Pencil;
  readonly FolderPlusIcon = FolderPlus;
  readonly FilePlusIcon = FilePlus;
  readonly FolderIcon = Folder;
  readonly FolderOpenIcon = FolderOpen;
  readonly CheckIcon = Check;
  readonly FileIcon = File;
  readonly ArrowLeftSmallIcon = ArrowLeftSmall;
  readonly Link2Icon = Link2;
  readonly SearchIcon = Search;
  readonly LockIcon = Lock;

  private readonly nav = new FolderNavigation<PlantillaFolder>();
  readonly docCurrentFolderId = this.nav.currentFolderId;
  readonly docFolderPath = this.nav.path;
  isCreatingFolder = signal(false);
  newFolderName = signal('');
  isAddingFile = signal(false);
  newFileName = signal('');
  renamingFolderId = signal<string | null>(null);
  renameValue = signal('');
  deletingFolderId = signal<string | null>(null);
  deletingFileId = signal<string | null>(null);
  linkingFileId = signal<string | null>(null);
  templateSearch = signal('');

  readonly filteredDocTemplates = computed(() => {
    const q = this.templateSearch().toLowerCase();
    return this.docTemplateService.templates().filter(t =>
      !q || t.name.toLowerCase().includes(q)
    );
  });

  readonly docCurrentFolders = computed(() =>
    this.folderService.folders().filter(f => f.parentId === this.docCurrentFolderId())
  );
  readonly docCurrentFiles = computed(() =>
    this.fileService.files().filter(f => f.folderId === this.docCurrentFolderId())
  );

  navigateToFolder(folder: PlantillaFolder): void {
    this.nav.open(folder);
  }

  navigateToRoot(): void {
    this.nav.toRoot();
  }

  navigateToBreadcrumb(index: number): void {
    this.nav.toBreadcrumb(index);
  }

  navigateBack(): void {
    this.nav.back();
  }

  async createFolder(): Promise<void> {
    const name = this.newFolderName().trim();
    if (!name) return;
    await this.toast.run(
      () => this.folderService.createFolder({ plantillaId: this.plantillaId(), parentId: this.docCurrentFolderId(), name }),
      {
        errorTitle: 'No se pudo crear la carpeta',
        onSuccess: () => {
          this.newFolderName.set('');
          this.isCreatingFolder.set(false);
        },
      }
    );
  }

  async addFile(): Promise<void> {
    const name = this.newFileName().trim();
    if (!name) return;
    await this.toast.run(
      () => this.fileService.addFile(this.plantillaId(), this.docCurrentFolderId(), name),
      {
        errorTitle: 'No se pudo crear el archivo',
        onSuccess: () => {
          this.newFileName.set('');
          this.isAddingFile.set(false);
        },
      }
    );
  }

  startRename(folder: PlantillaFolder): void {
    this.renamingFolderId.set(folder.id);
    this.renameValue.set(folder.name);
  }

  async confirmRename(folderId: string): Promise<void> {
    const name = this.renameValue().trim();
    if (!name) return;
    await this.toast.run(() => this.folderService.updateFolder(folderId, { name }, this.plantillaId()), {
      errorTitle: 'No se pudo renombrar la carpeta',
      onSuccess: () => this.renamingFolderId.set(null),
    });
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.toast.run(() => this.deleteFolderRecursive(folderId), {
      successMessage: 'Carpeta eliminada',
      errorTitle: 'No se pudo eliminar la carpeta',
      onSuccess: () => this.deletingFolderId.set(null),
    });
  }

  private async deleteFolderRecursive(folderId: string): Promise<void> {
    for (const sub of this.folderService.folders().filter(f => f.parentId === folderId)) {
      await this.deleteFolderRecursive(sub.id);
    }
    for (const file of this.fileService.files().filter(f => f.folderId === folderId)) {
      await this.fileService.deleteFile(file.id, this.plantillaId());
    }
    await this.folderService.deleteFolder(folderId);
  }

  async deleteFile(file: PlantillaFile): Promise<void> {
    await this.toast.run(() => this.fileService.deleteFile(file.id, this.plantillaId()), {
      successMessage: 'Archivo eliminado',
      errorTitle: 'No se pudo eliminar el archivo',
      onSuccess: () => this.deletingFileId.set(null),
    });
  }

  getDocTemplateName(docTemplateId: string): string {
    return this.docTemplateService.templates().find(t => t.id === docTemplateId)?.name ?? 'Plantilla';
  }

  openLinkPicker(file: PlantillaFile): void {
    this.templateSearch.set('');
    this.linkingFileId.set(file.id);
  }

  async linkTemplate(docTemplateId: string): Promise<void> {
    const fileId = this.linkingFileId();
    if (!fileId) return;
    await this.toast.run(() => this.fileService.linkTemplate(fileId, docTemplateId), {
      successMessage: 'Plantilla vinculada',
      errorTitle: 'No se pudo vincular la plantilla',
      onSuccess: () => this.linkingFileId.set(null),
    });
  }

  // ── Visibilidad de plantillas (solo Admin) ─────────────
  readonly visibilityTarget = signal<PlantillaFile | null>(null);
  readonly visibilitySaving = signal(false);

  openVisibility(file: PlantillaFile): void {
    this.visibilityTarget.set(file);
  }

  async onVisibilitySaved(state: DocAccessState): Promise<void> {
    const file = this.visibilityTarget();
    if (!file) return;
    this.visibilitySaving.set(true);
    try {
      await this.toast.run(
        () => this.fileService.setVisibility(
          file.id,
          state.restricted ? 'restricted' : 'all',
          state.allowedRoles,
          state.allowedUserIds,
        ),
        {
          successMessage: 'Visibilidad actualizada',
          errorTitle: 'No se pudo actualizar la visibilidad',
          onSuccess: () => this.visibilityTarget.set(null),
        },
      );
    } finally {
      this.visibilitySaving.set(false);
    }
  }

  async unlinkTemplate(file: PlantillaFile): Promise<void> {
    await this.toast.run(() => this.fileService.linkTemplate(file.id, null), {
      errorTitle: 'No se pudo desvincular la plantilla',
    });
  }
}
