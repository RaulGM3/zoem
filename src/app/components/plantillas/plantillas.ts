import {
  Component, OnInit, signal, computed, ChangeDetectionStrategy, inject,
} from '@angular/core';
import { estadoCupo } from '../../core/planes/derechos';
import { MejoraPlanService } from '../../core/planes/mejora-plan.service';
import { PlanService } from '../../core/planes/plan.service';
import { CupoComponent } from '../../shared/components/cupo/cupo';
import { PlantillasService } from '../../core/services/plantillas.service';
import { UsersService } from '../../core/services/users';
import { ToastService } from '../../core/services/toast.service';
import { CasoTipo, TipoCosto } from '../../interfaces';
import { PlantillasHeaderComponent } from './components/plantillas-header/plantillas-header';
import { PlantillasListComponent } from './components/plantillas-list/plantillas-list';
import { PlantillaDrawerComponent } from './components/plantilla-drawer/plantilla-drawer';

@Component({
  selector: 'app-plantillas',
  imports: [CupoComponent, PlantillasHeaderComponent, PlantillasListComponent, PlantillaDrawerComponent],
  templateUrl: './plantillas.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantillasComponent implements OnInit {
  protected readonly plantillasService = inject(PlantillasService);
  protected readonly usersService = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly plan = inject(PlanService);
  private readonly mejora = inject(MejoraPlanService);

  readonly usadas = computed(() => this.plantillasService.plantillas().length);
  readonly limite = computed(() => this.plan.limite('plantillas'));
  /** Solo cliente: la fase 3 lo hace cumplir en servidor (reglas + contadores). */
  readonly cupoAgotado = computed(() => estadoCupo(this.usadas(), this.limite()) === 'agotado');

  showForm = signal(false);

  readonly tipos: CasoTipo[] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];

  readonly tiposCosto: { value: TipoCosto; label: string }[] = [
    { value: 'gastos_repercutibles', label: 'Gastos repercutibles' },
    { value: 'suplido', label: 'Suplido' },
    { value: 'intereses_demora', label: 'Intereses de demora' },
    { value: 'saldos_clientes', label: 'Saldos de clientes' },
    { value: 'provisiones_fondos', label: 'Provisiones de fondos' },
    { value: 'cuota_litis', label: 'Cuota litis' },
    { value: 'costas_judiciales', label: 'Costas judiciales' },
  ];

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.plantillasService.loadPlantillas(),
      this.usersService.loadMembers(),
    ]);
  }

  openNew(): void {
    if (this.cupoAgotado()) {
      this.mejora.abrir();
      return;
    }
    this.showForm.set(true);
  }

  async deletePlantilla(id: string): Promise<void> {
    await this.toast.run(() => this.plantillasService.deletePlantilla(id), {
      successMessage: 'Plantilla eliminada',
      errorTitle: 'No se pudo eliminar la plantilla',
    });
  }

  onDrawerClosed(): void {
    this.showForm.set(false);
  }
}
