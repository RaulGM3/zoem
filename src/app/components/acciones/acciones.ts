import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideAngularModule, Plus, Pencil, Trash2, FileText } from 'lucide-angular';
import { AccionesService } from '../../core/services/acciones.service';
import { DocTemplateService } from '../../core/services/doc-template.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { CANAL_LABELS, type Accion, type AccionInput } from '../../interfaces/accion.interface';
import { AccionFormDrawerComponent } from '../../shared/components/accion-form-drawer/accion-form-drawer';

/** Catálogo de acciones de la empresa (Configuración → Acciones). */
@Component({
  selector: 'app-acciones',
  imports: [LucideAngularModule, AccionFormDrawerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './acciones.html',
})
export class AccionesComponent implements OnInit {
  private readonly accionesService = inject(AccionesService);
  private readonly docTemplates = inject(DocTemplateService);
  private readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);

  readonly PlusIcon = Plus;
  readonly PencilIcon = Pencil;
  readonly TrashIcon = Trash2;
  readonly FileTextIcon = FileText;

  readonly acciones = this.accionesService.acciones;
  readonly loading = this.accionesService.loading;
  readonly canEdit = computed(() => this.perm.can('Configuración', 'editar'));
  readonly plantillasListas = computed(() => this.docTemplates.templates().filter((t) => t.status === 'listo'));
  private readonly nombresDoc = computed(() => new Map(this.docTemplates.templates().map((t) => [t.id, t.name])));

  /** `undefined` = cerrado, `null` = alta, `Accion` = edición. */
  readonly drawer = signal<Accion | null | undefined>(undefined);
  readonly saving = signal(false);
  readonly confirmandoId = signal<string | null>(null);

  ngOnInit(): void {
    void this.toast.run(() => this.accionesService.cargar(), { errorTitle: 'No se pudieron cargar las acciones' });
    void this.docTemplates.loadTemplates();
  }

  canalesTexto(a: Accion): string {
    return a.canales.map((c) => CANAL_LABELS[c]).join(', ');
  }

  nombreDoc(id: string | undefined): string | null {
    return id ? (this.nombresDoc().get(id) ?? 'Plantilla no disponible') : null;
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
      await this.toast.run(
        async () => {
          if (actual) await this.accionesService.actualizar(actual.id, data);
          else await this.accionesService.crear(data);
          await this.accionesService.cargar();
        },
        {
          successMessage: actual ? 'Acción actualizada' : 'Acción creada',
          errorTitle: 'No se pudo guardar la acción',
          onSuccess: () => this.cerrar(),
        },
      );
    } finally {
      this.saving.set(false);
    }
  }

  async alternarActiva(a: Accion): Promise<void> {
    if (!this.canEdit()) return;
    await this.toast.run(
      async () => {
        await this.accionesService.actualizar(a.id, { activa: !a.activa });
        await this.accionesService.cargar();
      },
      { errorTitle: 'No se pudo cambiar el estado de la acción' },
    );
  }

  async eliminar(id: string): Promise<void> {
    if (!this.canEdit()) return;
    await this.toast.run(
      async () => {
        await this.accionesService.eliminar(id);
        await this.accionesService.cargar();
      },
      {
        successMessage: 'Acción eliminada',
        errorTitle: 'No se pudo eliminar la acción',
        onSuccess: () => this.confirmandoId.set(null),
      },
    );
  }
}
