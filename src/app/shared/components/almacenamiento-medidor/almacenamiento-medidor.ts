import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlanService } from '../../../core/planes/plan.service';
import { UsoService } from '../../../core/planes/uso.service';
import { CupoComponent } from '../cupo/cupo';

/** Medidor del almacenamiento de documentos del plan (solo si el plan tiene un límite finito). */
@Component({
  selector: 'app-almacenamiento-medidor',
  imports: [CupoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-cupo etiqueta="MB de documentos" [usado]="usado()" [limite]="limite()" />`,
})
export class AlmacenamientoMedidorComponent {
  private readonly plan = inject(PlanService);
  private readonly uso = inject(UsoService);

  protected readonly limite = () => this.plan.limite('documentosMB');
  protected readonly usado = () => this.uso.usado('documentosMB');
}
