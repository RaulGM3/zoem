import {
  Component, OnInit, signal, computed,
  ChangeDetectionStrategy, inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Save } from 'lucide-angular';
import { PlantillasService } from '../../core/services/plantillas.service';
import { ToastService } from '../../core/services/toast.service';
import { PlantillaFolderService } from '../../core/services/plantilla-folder.service';
import { PlantillaFileService } from '../../core/services/plantilla-file.service';
import { DocTemplateService } from '../../core/services/doc-template.service';
import { UsersService } from '../../core/services/users';
import { CasoPlantilla, CasoTipo, HitoPlantilla, PartidaCosto } from '../../interfaces';
import { PlantillaHitosTabComponent } from './components/plantilla-hitos-tab/plantilla-hitos-tab';
import { PlantillaCostosTabComponent } from './components/plantilla-costos-tab/plantilla-costos-tab';
import { PlantillaDocumentosTabComponent } from './components/plantilla-documentos-tab/plantilla-documentos-tab';
import { PlantillaAccionesTabComponent } from './components/plantilla-acciones-tab/plantilla-acciones-tab';

type Tab = 'datos' | 'hitos' | 'costos' | 'documentos' | 'acciones';

const TIPOS_CASO: CasoTipo[] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];

@Component({
  selector: 'app-plantilla-detail',
  imports: [
    LucideAngularModule, RouterLink,
    PlantillaHitosTabComponent, PlantillaCostosTabComponent, PlantillaDocumentosTabComponent, PlantillaAccionesTabComponent,
  ],
  templateUrl: './plantilla-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantillaDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly plantillasService = inject(PlantillasService);
  private readonly toast = inject(ToastService);
  private readonly folderService = inject(PlantillaFolderService);
  private readonly fileService = inject(PlantillaFileService);
  private readonly docTemplateService = inject(DocTemplateService);
  private readonly usersService = inject(UsersService);

  readonly ArrowLeftIcon = ArrowLeft;
  readonly SaveIcon = Save;

  readonly tipos = TIPOS_CASO;

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

  // ── Costos ────────────────────────────────────────
  savingCostos = signal(false);
  formHonorarios = signal('');
  formSuplidos = signal<PartidaCosto[]>([]);

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
    if (this.savingHitos()) return;
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
}
