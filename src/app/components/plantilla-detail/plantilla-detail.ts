import {
  Component, OnInit, signal, computed,
  ChangeDetectionStrategy, inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ArrowLeft, Save, GripVertical, X, Trash2, Pencil,
  FolderPlus, FilePlus, Folder, FolderOpen, Check, File, ArrowLeft as ArrowLeftSmall,
  Link2, Search,
} from 'lucide-angular';
import { PlantillasService } from '../../core/services/plantillas.service';
import { ToastService } from '../../core/services/toast.service';
import { PlantillaFolderService } from '../../core/services/plantilla-folder.service';
import { PlantillaFileService } from '../../core/services/plantilla-file.service';
import { DocTemplateService } from '../../core/services/doc-template.service';
import { UsersService } from '../../core/services/users';
import {
  CasoPlantilla, CasoTipo, HitoPlantilla, PartidaCosto, TipoCosto,
  PlantillaFolder, PlantillaFile,
} from '../../interfaces';

type Tab = 'datos' | 'hitos' | 'costos' | 'documentos';

const TIPOS_COSTO: { value: TipoCosto; label: string }[] = [
  { value: 'gastos_repercutibles', label: 'Gastos repercutibles' },
  { value: 'suplido', label: 'Suplido' },
  { value: 'intereses_demora', label: 'Intereses de demora' },
  { value: 'saldos_clientes', label: 'Saldos de clientes' },
  { value: 'provisiones_fondos', label: 'Provisiones de fondos' },
  { value: 'cuota_litis', label: 'Cuota litis' },
  { value: 'costas_judiciales', label: 'Costas judiciales' },
];

const TIPOS_CASO: CasoTipo[] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];

@Component({
  selector: 'app-plantilla-detail',
  imports: [LucideAngularModule, RouterLink],
  templateUrl: './plantilla-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantillaDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly plantillasService = inject(PlantillasService);
  private readonly toast = inject(ToastService);
  readonly folderService = inject(PlantillaFolderService);
  readonly fileService = inject(PlantillaFileService);
  readonly docTemplateService = inject(DocTemplateService);
  private readonly usersService = inject(UsersService);

  readonly ArrowLeftIcon = ArrowLeft;
  readonly SaveIcon = Save;
  readonly GripIcon = GripVertical;
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

  readonly tipos = TIPOS_CASO;
  readonly tiposCosto = TIPOS_COSTO;

  readonly loading = signal(true);
  readonly plantilla = signal<CasoPlantilla | null>(null);
  readonly activeTab = signal<Tab>('datos');

  readonly members = computed(() => this.usersService.members());

  // ── Datos básicos ─────────────────────────────────
  savingDatos = signal(false);
  formNombre = signal('');
  formDescripcion = signal('');
  formTipo = signal<CasoTipo | ''>('');

  // ── Hitos ─────────────────────────────────────────
  savingHitos = signal(false);
  formHitos = signal<HitoPlantilla[]>([]);

  hitoTitulo = signal('');
  hitoDescripcion = signal('');
  hitoDias = signal('0');
  hitoAsignado = signal('');

  hitosDragFrom = signal<number | null>(null);
  hitosDragOver = signal<number | null>(null);

  editingHitoIndex = signal<number | null>(null);
  editHitoTitulo = signal('');
  editHitoDescripcion = signal('');
  editHitoDias = signal('0');
  editHitoAsignado = signal('');

  // ── Costos ────────────────────────────────────────
  savingCostos = signal(false);
  formHonorarios = signal('');
  formSuplidos = signal<PartidaCosto[]>([]);

  suplidoNombre = signal('');
  suplidoTipo = signal<TipoCosto | ''>('');
  suplidoImporte = signal('');

  suplidosDragFrom = signal<number | null>(null);
  suplidosDragOver = signal<number | null>(null);

  editingSuplidoIndex = signal<number | null>(null);
  editSuplidoNombre = signal('');
  editSuplidoTipo = signal<TipoCosto | ''>('');
  editSuplidoImporte = signal('');

  // ── Documentos ────────────────────────────────────
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

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/plantillas']); return; }

    await this.usersService.loadMembers();
    const p = await this.plantillasService.getPlantilla(id);
    if (!p) { this.router.navigate(['/plantillas']); return; }

    this.plantilla.set(p);
    this.formNombre.set(p.nombre);
    this.formDescripcion.set(p.descripcion ?? '');
    this.formTipo.set(p.tipo ?? '');
    this.formHonorarios.set(p.modeloCostos.honorariosBase?.toString() ?? '');
    this.formHitos.set([...p.hitos].sort((a, b) => a.orden - b.orden));
    this.formSuplidos.set([...p.modeloCostos.suplidos]);

    this.folderService.loadFolders(id);
    this.fileService.loadFiles(id);
    void this.docTemplateService.loadTemplates();

    const m = this.usersService.members();
    this.hitoAsignado.set(m.length === 1 ? m[0].userId : '');

    this.loading.set(false);
  }

  get plantillaId(): string {
    return this.plantilla()!.id;
  }

  // ── Tab navigation ────────────────────────────────
  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  // ── Datos básicos ─────────────────────────────────
  async saveDatos(): Promise<void> {
    if (!this.formNombre().trim()) return;
    this.savingDatos.set(true);
    try {
      await this.toast.run(
        () => this.plantillasService.updatePlantilla(this.plantillaId, {
          nombre: this.formNombre().trim(),
          descripcion: this.formDescripcion().trim() || undefined,
          tipo: (this.formTipo() as CasoTipo) || undefined,
        }),
        {
          successMessage: 'Datos guardados',
          errorTitle: 'No se pudieron guardar los datos',
          onSuccess: () => this.plantilla.update(p => p ? { ...p, nombre: this.formNombre().trim() } : p),
        }
      );
    } finally {
      this.savingDatos.set(false);
    }
  }

  // ── Hitos ─────────────────────────────────────────
  async saveHitos(): Promise<void> {
    this.savingHitos.set(true);
    try {
      await this.toast.run(
        () => this.plantillasService.updatePlantilla(this.plantillaId, { hitos: this.formHitos() }),
        { successMessage: 'Hitos guardados', errorTitle: 'No se pudieron guardar los hitos' }
      );
    } finally {
      this.savingHitos.set(false);
    }
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
    this.formHitos.update(list => {
      const filtered = list.filter(h => h.id !== id);
      filtered.forEach((h, i) => (h.orden = i));
      return filtered;
    });
  }

  clearHitoForm(): void {
    this.hitoTitulo.set('');
    this.hitoDescripcion.set('');
    this.hitoDias.set('0');
    const m = this.members();
    this.hitoAsignado.set(m.length === 1 ? m[0].userId : '');
  }

  onHitoDragStart(event: DragEvent, index: number): void {
    this.hitosDragFrom.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onHitoDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.hitosDragOver.set(index);
  }

  onHitoDrop(event: DragEvent): void {
    event.preventDefault();
    const from = this.hitosDragFrom();
    const to = this.hitosDragOver();
    this.hitosDragFrom.set(null);
    this.hitosDragOver.set(null);
    if (from === null || to === null || from === to) return;
    const list = [...this.formHitos()];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    list.forEach((h, i) => (h.orden = i));
    this.formHitos.set(list);
  }

  onHitoDragEnd(): void {
    this.hitosDragFrom.set(null);
    this.hitosDragOver.set(null);
  }

  openEditHito(index: number): void {
    const h = this.formHitos()[index];
    this.editHitoTitulo.set(h.titulo);
    this.editHitoDescripcion.set(h.descripcion ?? '');
    this.editHitoDias.set(h.diasDesdeInicio.toString());
    this.editHitoAsignado.set(h.asignadoA ?? '');
    this.editingHitoIndex.set(index);
  }

  confirmEditHito(): void {
    const index = this.editingHitoIndex();
    if (index === null || !this.editHitoTitulo().trim()) return;
    this.formHitos.update(list => {
      const updated = [...list];
      updated[index] = {
        ...updated[index],
        titulo: this.editHitoTitulo().trim(),
        descripcion: this.editHitoDescripcion().trim() || undefined,
        diasDesdeInicio: parseInt(this.editHitoDias(), 10) || 0,
        asignadoA: this.editHitoAsignado() || undefined,
      };
      return updated;
    });
    this.editingHitoIndex.set(null);
  }

  cancelEditHito(): void {
    this.editingHitoIndex.set(null);
  }

  getMemberName(userId?: string): string {
    if (!userId) return '—';
    const m = this.members().find(x => x.userId === userId);
    return m ? `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}` : userId;
  }

  // ── Costos ────────────────────────────────────────
  async saveCostos(): Promise<void> {
    this.savingCostos.set(true);
    try {
      await this.toast.run(
        () => this.plantillasService.updatePlantilla(this.plantillaId, {
          modeloCostos: {
            honorariosBase: this.formHonorarios() ? parseFloat(this.formHonorarios()) : undefined,
            suplidos: this.formSuplidos(),
          },
        }),
        { successMessage: 'Costos guardados', errorTitle: 'No se pudieron guardar los costos' }
      );
    } finally {
      this.savingCostos.set(false);
    }
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
    return this.tiposCosto.find(t => t.value === tipo)?.label ?? tipo;
  }

  onSuplidoDragStart(event: DragEvent, index: number): void {
    this.suplidosDragFrom.set(index);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onSuplidoDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.suplidosDragOver.set(index);
  }

  onSuplidoDrop(event: DragEvent): void {
    event.preventDefault();
    const from = this.suplidosDragFrom();
    const to = this.suplidosDragOver();
    this.suplidosDragFrom.set(null);
    this.suplidosDragOver.set(null);
    if (from === null || to === null || from === to) return;
    const list = [...this.formSuplidos()];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    this.formSuplidos.set(list);
  }

  onSuplidoDragEnd(): void {
    this.suplidosDragFrom.set(null);
    this.suplidosDragOver.set(null);
  }

  openEditSuplido(index: number): void {
    const s = this.formSuplidos()[index];
    this.editSuplidoNombre.set(s.nombre);
    this.editSuplidoTipo.set(s.tipo);
    this.editSuplidoImporte.set(s.importeEstimado?.toString() ?? '');
    this.editingSuplidoIndex.set(index);
  }

  confirmEditSuplido(): void {
    const index = this.editingSuplidoIndex();
    if (index === null || !this.editSuplidoNombre().trim() || !this.editSuplidoTipo()) return;
    const importe = this.editSuplidoImporte() ? parseFloat(this.editSuplidoImporte()) : undefined;
    this.formSuplidos.update(list => {
      const updated = [...list];
      updated[index] = {
        ...updated[index],
        nombre: this.editSuplidoNombre().trim(),
        tipo: this.editSuplidoTipo() as TipoCosto,
        importeEstimado: importe,
      };
      return updated;
    });
    this.editingSuplidoIndex.set(null);
  }

  cancelEditSuplido(): void {
    this.editingSuplidoIndex.set(null);
  }

  // ── Documentos ────────────────────────────────────
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
    await this.toast.run(
      () => this.folderService.createFolder({ plantillaId: this.plantillaId, parentId: this.docCurrentFolderId(), name }),
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
      () => this.fileService.addFile(this.plantillaId, this.docCurrentFolderId(), name),
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
    await this.toast.run(() => this.folderService.updateFolder(folderId, { name }, this.plantillaId), {
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
      await this.fileService.deleteFile(file.id, this.plantillaId);
    }
    await this.folderService.deleteFolder(folderId);
  }

  async deleteFile(file: PlantillaFile): Promise<void> {
    await this.toast.run(() => this.fileService.deleteFile(file.id, this.plantillaId), {
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

  async unlinkTemplate(file: PlantillaFile): Promise<void> {
    await this.toast.run(() => this.fileService.linkTemplate(file.id, null), {
      errorTitle: 'No se pudo desvincular la plantilla',
    });
  }
}
