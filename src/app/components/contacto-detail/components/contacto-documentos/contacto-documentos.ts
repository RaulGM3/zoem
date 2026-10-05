import {
  Component, ChangeDetectionStrategy, computed, effect, inject, input, signal, untracked,
} from '@angular/core';
import {
  LucideAngularModule, FolderPlus, Upload, Folder, FolderOpen, Check, X, Pencil, Download, Trash2,
} from 'lucide-angular';
import { ContactFolderService } from '../../../../core/services/contact-folder.service';
import { ContactFileService } from '../../../../core/services/contact-file.service';
import { UploadQueueService } from '../../../../core/services/upload-queue.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DOCUMENT } from '@angular/common';
import { BreakpointService } from '../../../../core/services/breakpoint.service';
import { ActionMenuComponent, type MenuAction } from '../../../../shared/components/action-menu/action-menu';
import {
  ListCardDirective, ListTableDirective, ResponsiveListComponent,
} from '../../../../shared/components/responsive-list/responsive-list';
import { FolderNavigation } from '../../../../core/documentos/folder-navigation';
import type { ContactFolder, ContactFile } from '../../../../interfaces';

/**
 * Explorador de documentos de un contacto: carpetas, subida y borrado de
 * archivos. La carga de carpetas y archivos la dispara la ficha del contacto.
 */
@Component({
  selector: 'app-contacto-documentos',
  host: { class: 'block' },
  imports: [LucideAngularModule, ActionMenuComponent, ResponsiveListComponent, ListCardDirective, ListTableDirective],
  templateUrl: './contacto-documentos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactoDocumentosComponent {
  readonly contactId = input.required<string>();

  readonly folderService = inject(ContactFolderService);
  readonly fileService = inject(ContactFileService);
  private readonly toast = inject(ToastService);
  private readonly uploadQueue = inject(UploadQueueService);
  readonly perm = inject(PermissionService);
  protected readonly bp = inject(BreakpointService);
  private readonly doc = inject(DOCUMENT);

  readonly FolderPlusIcon = FolderPlus;
  readonly UploadIcon = Upload;
  readonly FolderIcon = Folder;
  readonly FolderOpenIcon = FolderOpen;
  readonly CheckIcon = Check;
  readonly XIcon = X;
  readonly PencilIcon = Pencil;
  readonly DownloadIcon = Download;
  readonly Trash2Icon = Trash2;

  private readonly nav = new FolderNavigation<ContactFolder>();
  readonly currentFolderId = this.nav.currentFolderId;
  readonly folderPath = this.nav.path;
  isCreatingFolder = signal(false);
  newFolderName = signal('');
  renamingFolderId = signal<string | null>(null);
  renameValue = signal('');
  deletingFolderId = signal<string | null>(null);
  deletingFileId = signal<string | null>(null);

  readonly totalDocumentos = computed(() => this.fileService.files().length);

  readonly currentFolders = computed(() =>
    this.folderService.folders().filter((f) => f.parentId === this.currentFolderId())
  );

  readonly currentFiles = computed(() =>
    this.fileService.files().filter((f) => f.folderId === this.currentFolderId())
  );

  constructor() {
    // Al cambiar de contacto la navegación vuelve a la raíz: la carpeta abierta
    // pertenecía al contacto anterior.
    effect(() => {
      this.contactId();
      untracked(() => this.nav.toRoot());
    });
  }

  /** Acciones de un archivo en el menú móvil. Mismos permisos que los botones de escritorio. */
  accionesArchivo(): MenuAction[] {
    const acciones: MenuAction[] = [{ id: 'download', label: 'Descargar', icon: Download }];
    if (this.perm.can('Contactos', 'eliminar')) acciones.push({ id: 'delete', label: 'Eliminar', icon: Trash2, danger: true });
    return acciones;
  }

  /** Acciones de una carpeta en el menú móvil. Mismos permisos que los botones de escritorio. */
  accionesCarpeta(): MenuAction[] {
    const acciones: MenuAction[] = [];
    if (this.perm.can('Contactos', 'editar')) acciones.push({ id: 'rename', label: 'Renombrar', icon: Pencil });
    if (this.perm.can('Contactos', 'eliminar')) acciones.push({ id: 'delete', label: 'Eliminar', icon: Trash2, danger: true });
    return acciones;
  }

  onAccionArchivo(id: string, file: ContactFile): void {
    if (id === 'download') this.doc.defaultView?.open(file.downloadUrl, '_blank', 'noopener');
    else if (id === 'delete') this.deletingFileId.set(file.id);
  }

  onAccionCarpeta(id: string, folder: ContactFolder): void {
    if (id === 'rename') this.startRename(folder);
    else if (id === 'delete') this.deletingFolderId.set(folder.id);
  }

  navigateToFolder(folder: ContactFolder) {
    this.nav.open(folder);
  }

  navigateToRoot() {
    this.nav.toRoot();
  }

  navigateToBreadcrumb(index: number) {
    this.nav.toBreadcrumb(index);
  }

  async createFolder() {
    if (!this.perm.can('Contactos', 'crear')) return;
    const name = this.newFolderName().trim();
    if (!name) return;
    await this.toast.run(
      () => this.folderService.createFolder({
        contactId: this.contactId(),
        parentId: this.currentFolderId(),
        name,
      }),
      {
        errorTitle: 'No se pudo crear la carpeta',
        onSuccess: () => {
          this.newFolderName.set('');
          this.isCreatingFolder.set(false);
        },
      }
    );
  }

  startRename(folder: ContactFolder) {
    if (!this.perm.can('Contactos', 'editar')) return;
    this.renamingFolderId.set(folder.id);
    this.renameValue.set(folder.name);
  }

  async confirmRename(folderId: string) {
    if (!this.perm.can('Contactos', 'editar')) return;
    const name = this.renameValue().trim();
    if (!name) return;
    await this.toast.run(() => this.folderService.updateFolder(folderId, { name }, this.contactId()), {
      errorTitle: 'No se pudo renombrar la carpeta',
      onSuccess: () => this.renamingFolderId.set(null),
    });
  }

  async deleteFolder(folderId: string) {
    if (!this.perm.can('Contactos', 'eliminar')) return;
    await this.toast.run(() => this.deleteFolderRecursive(folderId), {
      successMessage: 'Carpeta eliminada',
      errorTitle: 'No se pudo eliminar la carpeta',
      onSuccess: () => this.deletingFolderId.set(null),
    });
  }

  private async deleteFolderRecursive(folderId: string) {
    const subFolders = this.folderService.folders().filter((f) => f.parentId === folderId);
    for (const sub of subFolders) {
      await this.deleteFolderRecursive(sub.id);
    }
    const files = this.fileService.files().filter((f) => f.folderId === folderId);
    for (const file of files) {
      await this.fileService.deleteFile(file.id, file.storagePath, this.contactId());
    }
    await this.folderService.deleteFolder(folderId);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!this.perm.can('Contactos', 'crear')) return;
    for (const file of files) {
      this.uploadQueue.enqueue(
        () => this.fileService.uploadFile(this.contactId(), this.currentFolderId(), file),
        file.name,
        { successMessage: `"${file.name}" subido`, errorTitle: 'No se pudo subir el archivo' },
      );
    }
  }

  async deleteFile(file: ContactFile) {
    if (!this.perm.can('Contactos', 'eliminar')) return;
    await this.toast.run(() => this.fileService.deleteFile(file.id, file.storagePath, this.contactId()), {
      successMessage: 'Archivo eliminado',
      errorTitle: 'No se pudo eliminar el archivo',
      onSuccess: () => this.deletingFileId.set(null),
    });
  }

  getFileIcon(mimeType: string): string {
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    return '📎';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
