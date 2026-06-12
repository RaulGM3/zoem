import {
  Component, ChangeDetectionStrategy, inject, input, output, signal, computed, effect,
} from '@angular/core';
import {
  LucideAngularModule,
  X, Trash2, ChevronDown, ChevronUp,
  FolderPlus, FilePlus, Folder, FolderOpen, Check, Pencil, File, ArrowLeft,
} from 'lucide-angular';
import { PlantillasService } from '../../../../core/services/plantillas.service';
import { PlantillaFolderService } from '../../../../core/services/plantilla-folder.service';
import { PlantillaFileService } from '../../../../core/services/plantilla-file.service';
import {
  CasoPlantilla, CasoTipo, HitoPlantilla, PartidaCosto, TipoCosto,
  PlantillaFolder, PlantillaFile, CompanyMember,
} from '../../../../interfaces';

@Component({
  selector: 'app-plantilla-drawer',
  imports: [LucideAngularModule],
  templateUrl: './plantilla-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantillaDrawerComponent {
  private readonly plantillasService = inject(PlantillasService);
  readonly folderService = inject(PlantillaFolderService);
  readonly fileService = inject(PlantillaFileService);

  readonly plantilla = input<CasoPlantilla | null>(null);
  readonly members = input.required<CompanyMember[]>();
  readonly tipos = input.required<CasoTipo[]>();
  readonly tiposCosto = input.required<{ value: TipoCosto; label: string }[]>();

  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly Trash2Icon = Trash2;
  readonly ChevronDownIcon = ChevronDown;
  readonly ChevronUpIcon = ChevronUp;
  readonly FolderPlusIcon = FolderPlus;
  readonly FilePlusIcon = FilePlus;
  readonly FolderIcon = Folder;
  readonly FolderOpenIcon = FolderOpen;
  readonly CheckIcon = Check;
  readonly PencilIcon = Pencil;
  readonly FileIcon = File;
  readonly ArrowLeftIcon = ArrowLeft;

  saving = signal(false);
  formNombre = signal('');
  formDescripcion = signal('');
  formTipo = signal<CasoTipo | ''>('');
  formHonorarios = signal('');
  formHitos = signal<HitoPlantilla[]>([]);
  formSuplidos = signal<PartidaCosto[]>([]);

  hitoTitulo = signal('');
  hitoDescripcion = signal('');
  hitoDias = signal('0');
  hitoAsignado = signal('');

  suplidoNombre = signal('');
  suplidoTipo = signal<TipoCosto | ''>('');
  suplidoImporte = signal('');

  pendingPlantillaId = signal<string | null>(null);
  effectivePlantillaId = computed(() => this.pendingPlantillaId() ?? this.plantilla()?.id ?? null);

  docCurrentFolderId = signal<string | null>(null);
  docFolderPath = signal<PlantillaFolder[]>([]);
  isCreatingFolder = signal(false);
  newFolderName = signal('');
  isAddingFile = signal(false);
  newFileName = signal('');
  renamingFolderId = signal<string | null>(null);
  renameValue = signal('');
  deletingFolderId = signal<string | null>(null);
  deletingFileId = signal<string | null>(null);

  docCurrentFolders = computed(() =>
    this.folderService.folders().filter((f) => f.parentId === this.docCurrentFolderId())
  );
  docCurrentFiles = computed(() =>
    this.fileService.files().filter((f) => f.folderId === this.docCurrentFolderId())
  );

  constructor() {
    effect(() => {
      const p = this.plantilla();
      this.resetDocBrowser();
      if (p) {
        this.formNombre.set(p.nombre);
        this.formDescripcion.set(p.descripcion ?? '');
        this.formTipo.set(p.tipo ?? '');
        this.formHonorarios.set(p.modeloCostos.honorariosBase?.toString() ?? '');
        this.formHitos.set([...p.hitos]);
        this.formSuplidos.set([...p.modeloCostos.suplidos]);
        this.folderService.loadFolders(p.id);
        this.fileService.loadFiles(p.id);
      } else {
        this.formNombre.set('');
        this.formDescripcion.set('');
        this.formTipo.set('');
        this.formHonorarios.set('');
        this.formHitos.set([]);
        this.formSuplidos.set([]);
      }
      this.clearHitoForm();
      this.clearSuplidoForm();
    }, { allowSignalWrites: true });
  }

  async save(): Promise<void> {
    if (!this.formNombre().trim()) return;
    this.saving.set(true);
    try {
      const data = {
        nombre: this.formNombre().trim(),
        descripcion: this.formDescripcion().trim() || undefined,
        tipo: (this.formTipo() as CasoTipo) || undefined,
        hitos: this.formHitos(),
        modeloCostos: {
          honorariosBase: this.formHonorarios() ? parseFloat(this.formHonorarios()) : undefined,
          suplidos: this.formSuplidos(),
        },
      };
      const id = this.pendingPlantillaId() ?? this.plantilla()?.id;
      if (id) {
        await this.plantillasService.updatePlantilla(id, data);
      } else {
        await this.plantillasService.createPlantilla(data);
      }
      this.saved.emit();
    } finally {
      this.saving.set(false);
    }
  }

  private async ensurePlantillaId(): Promise<string | null> {
    const existing = this.pendingPlantillaId() ?? this.plantilla()?.id;
    if (existing) return existing;
    if (!this.formNombre().trim()) return null;
    const data = {
      nombre: this.formNombre().trim(),
      descripcion: this.formDescripcion().trim() || undefined,
      tipo: (this.formTipo() as CasoTipo) || undefined,
      hitos: this.formHitos(),
      modeloCostos: {
        honorariosBase: this.formHonorarios() ? parseFloat(this.formHonorarios()) : undefined,
        suplidos: this.formSuplidos(),
      },
    };
    const newId = await this.plantillasService.createPlantilla(data);
    this.pendingPlantillaId.set(newId);
    this.folderService.loadFolders(newId);
    this.fileService.loadFiles(newId);
    return newId;
  }

  addHito(): void {
    if (!this.hitoTitulo().trim()) return;
    const current = this.formHitos();
    this.formHitos.set([
      ...current,
      {
        id: crypto.randomUUID(),
        titulo: this.hitoTitulo().trim(),
        descripcion: this.hitoDescripcion().trim() || undefined,
        diasDesdeInicio: parseInt(this.hitoDias(), 10) || 0,
        asignadoA: this.hitoAsignado() || undefined,
        orden: current.length,
      },
    ]);
    this.clearHitoForm();
  }

  removeHito(id: string): void {
    this.formHitos.update(list => list.filter(h => h.id !== id));
  }

  moveHito(index: number, dir: -1 | 1): void {
    const list = [...this.formHitos()];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    list.forEach((h, i) => (h.orden = i));
    this.formHitos.set(list);
  }

  clearHitoForm(): void {
    this.hitoTitulo.set('');
    this.hitoDescripcion.set('');
    this.hitoDias.set('0');
    const m = this.members();
    this.hitoAsignado.set(m.length === 1 ? m[0].userId : '');
  }

  addSuplido(): void {
    if (!this.suplidoNombre().trim() || !this.suplidoTipo()) return;
    const importe = this.suplidoImporte() ? parseFloat(this.suplidoImporte()) : undefined;
    this.formSuplidos.update(list => [
      ...list,
      {
        nombre: this.suplidoNombre().trim(),
        tipo: this.suplidoTipo() as TipoCosto,
        ...(importe != null ? { importeEstimado: importe } : {}),
      },
    ]);
    this.clearSuplidoForm();
  }

  removeSuplido(index: number): void {
    this.formSuplidos.update(list => list.filter((_, i) => i !== index));
  }

  clearSuplidoForm(): void {
    this.suplidoNombre.set('');
    this.suplidoTipo.set('');
    this.suplidoImporte.set('');
  }

  getTipoCostoLabel(tipo: TipoCosto): string {
    return this.tiposCosto().find(t => t.value === tipo)?.label ?? tipo;
  }

  getMemberName(userId?: string): string {
    if (!userId) return '—';
    const m = this.members().find(x => x.userId === userId);
    return m ? `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}` : userId;
  }

  private resetDocBrowser(): void {
    this.pendingPlantillaId.set(null);
    this.docCurrentFolderId.set(null);
    this.docFolderPath.set([]);
    this.isCreatingFolder.set(false);
    this.newFolderName.set('');
    this.isAddingFile.set(false);
    this.newFileName.set('');
    this.renamingFolderId.set(null);
    this.renameValue.set('');
    this.deletingFolderId.set(null);
    this.deletingFileId.set(null);
    this.folderService.folders.set([]);
    this.fileService.files.set([]);
  }

  navigateToFolder(folder: PlantillaFolder): void {
    this.docCurrentFolderId.set(folder.id);
    this.docFolderPath.update(path => [...path, folder]);
  }

  navigateToRoot(): void {
    this.docCurrentFolderId.set(null);
    this.docFolderPath.set([]);
  }

  navigateToBreadcrumb(index: number): void {
    const path = this.docFolderPath();
    this.docCurrentFolderId.set(path[index].id);
    this.docFolderPath.set(path.slice(0, index + 1));
  }

  navigateBack(): void {
    const path = this.docFolderPath();
    if (path.length <= 1) {
      this.navigateToRoot();
    } else {
      this.navigateToBreadcrumb(path.length - 2);
    }
  }

  async createFolder(): Promise<void> {
    const name = this.newFolderName().trim();
    if (!name) return;
    const plantillaId = await this.ensurePlantillaId();
    if (!plantillaId) return;
    await this.folderService.createFolder({ plantillaId, parentId: this.docCurrentFolderId(), name });
    this.newFolderName.set('');
    this.isCreatingFolder.set(false);
  }

  async addFile(): Promise<void> {
    const name = this.newFileName().trim();
    if (!name) return;
    const plantillaId = await this.ensurePlantillaId();
    if (!plantillaId) return;
    await this.fileService.addFile(plantillaId, this.docCurrentFolderId(), name);
    this.newFileName.set('');
    this.isAddingFile.set(false);
  }

  startRename(folder: PlantillaFolder): void {
    this.renamingFolderId.set(folder.id);
    this.renameValue.set(folder.name);
  }

  async confirmRename(folderId: string): Promise<void> {
    const name = this.renameValue().trim();
    const plantillaId = this.effectivePlantillaId();
    if (!name || !plantillaId) return;
    await this.folderService.updateFolder(folderId, { name }, plantillaId);
    this.renamingFolderId.set(null);
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.deleteFolderRecursive(folderId);
    this.deletingFolderId.set(null);
  }

  private async deleteFolderRecursive(folderId: string): Promise<void> {
    for (const sub of this.folderService.folders().filter(f => f.parentId === folderId)) {
      await this.deleteFolderRecursive(sub.id);
    }
    const plantillaId = this.effectivePlantillaId() ?? '';
    for (const file of this.fileService.files().filter(f => f.folderId === folderId)) {
      await this.fileService.deleteFile(file.id, plantillaId);
    }
    await this.folderService.deleteFolder(folderId);
  }

  async deleteFile(file: PlantillaFile): Promise<void> {
    await this.fileService.deleteFile(file.id, this.effectivePlantillaId() ?? '');
    this.deletingFileId.set(null);
  }
}
