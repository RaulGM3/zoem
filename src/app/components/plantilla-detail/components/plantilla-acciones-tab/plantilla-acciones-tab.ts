import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { LucideAngularModule, Plus, Pencil, Trash2 } from 'lucide-angular';
import { AccionesService } from '../../../../core/services/acciones.service';
import { DocTemplateService } from '../../../../core/services/doc-template.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CANAL_LABELS, type Accion, type AccionInput } from '../../../../interfaces/accion.interface';
import type { HitoPlantilla } from '../../../../interfaces/plantilla.interface';
import { AccionFormDrawerComponent } from '../../../../shared/components/accion-form-drawer/accion-form-drawer';

/** Pestaña "Acciones" de una plantilla de caso: acciones sugeridas al completar sus hitos. */
@Component({
  selector: 'app-plantilla-acciones-tab',
  imports: [LucideAngularModule, AccionFormDrawerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plantilla-acciones-tab.html',
})
export class PlantillaAccionesTabComponent implements OnInit {
  private readonly accionesService = inject(AccionesService);
  private readonly docTemplates = inject(DocTemplateService);
  private readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);

  readonly plantillaId = input.required<string>();
  readonly hitos = input.required<HitoPlantilla[]>();

  readonly PlusIcon = Plus;
  readonly PencilIcon = Pencil;
  readonly TrashIcon = Trash2;

  readonly acciones = signal<Accion[]>([]);
  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  readonly canEdit = computed(() => this.perm.can('Configuración', 'editar'));
  readonly plantillasListas = computed(() => this.docTemplates.templates().filter((t) => t.status === 'listo'));
  readonly drawer = signal<Accion | null | undefined>(undefined);
  readonly saving = signal(false);
  readonly confirmandoId = signal<string | null>(null);
  private readonly titulosHito = computed(() => new Map(this.hitos().map((h) => [h.id, h.titulo])));

  ngOnInit(): void {
    void this.recargar();
  }

  /** Lectura con error inline (no toast): así un fallo de carga no se confunde con el de otra pestaña. */
  async recargar(): Promise<void> {
    this.errorCarga.set(false);
    try {
      this.acciones.set(await this.accionesService.listarPorPlantilla(this.plantillaId()));
    } catch {
      this.errorCarga.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  tituloHito(id: string | undefined): string | null {
    return id ? (this.titulosHito().get(id) ?? 'Hito eliminado') : null;
  }

  canalesTexto(a: Accion): string {
    return a.canales.map((c) => CANAL_LABELS[c]).join(', ');
  }

  nueva(): void {
    if (this.canEdit()) this.drawer.set(null);
  }

  editar(a: Accion): void {
    if (this.canEdit()) this.drawer.set(a);
  }

  cerrar(): void {
    this.drawer.set(undefined);
  }

  async onGuardar(data: AccionInput): Promise<void> {
    const actual = this.drawer();
    if (actual === undefined || !this.canEdit()) return;
    this.saving.set(true);
    try {
      const ok = await this.toast.run(
        async () => {
          if (actual) await this.accionesService.actualizar(actual.id, data);
          else await this.accionesService.crear(data);
          return true;
        },
        {
          successMessage: actual ? 'Acción actualizada' : 'Acción creada',
          errorTitle: 'No se pudo guardar la acción',
          onSuccess: () => this.cerrar(),
        },
      );
      if (ok) await this.recargar();
    } finally {
      this.saving.set(false);
    }
  }

  async eliminar(id: string): Promise<void> {
    if (!this.canEdit()) return;
    const ok = await this.toast.run(
      async () => {
        await this.accionesService.eliminar(id);
        return true;
      },
      {
        successMessage: 'Acción eliminada',
        errorTitle: 'No se pudo eliminar la acción',
        onSuccess: () => this.confirmandoId.set(null),
      },
    );
    if (ok) await this.recargar();
  }
}
