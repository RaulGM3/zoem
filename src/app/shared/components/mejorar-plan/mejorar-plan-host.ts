import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MejoraPlanService } from '../../../core/planes/mejora-plan.service';
import { CompanyService } from '../../../core/services/company.service';
import { ZONA_POR_DEFECTO } from '../../../core/planes/periodo';
import { PlanService } from '../../../core/planes/plan.service';
import { ToastService } from '../../../core/services/toast.service';
import { MejorarPlanModalComponent } from './mejorar-plan-modal';

/**
 * Contenedor único del modal de mejora (se monta una vez en el layout).
 * Pago online: fase 4. Mientras tanto la petición se anuncia con un aviso.
 */
@Component({
  selector: 'app-mejorar-plan-host',
  imports: [MejorarPlanModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mejora.abierto()) {
      <app-mejorar-plan-modal [open]="true" [planActual]="plan.plan()" [funcion]="mejora.funcion()"
        [motivo]="mejora.motivo()" [zona]="zona()" [ahora]="plan.ahora()"
        (closed)="mejora.cerrar()" (solicitar)="solicitar()" />
    }
  `,
})
export class MejorarPlanHostComponent {
  protected readonly mejora = inject(MejoraPlanService);
  protected readonly plan = inject(PlanService);
  private readonly toast = inject(ToastService);
  private readonly company = inject(CompanyService);
  protected readonly zona = () => this.company.activeCompany()?.zonaHoraria ?? ZONA_POR_DEFECTO;

  protected solicitar(): void {
    this.toast.info(
      'El pago online llegará pronto. Mientras tanto, contacta con nosotros y activamos tu plan.',
      'Próximamente',
    );
    this.mejora.cerrar();
  }
}
