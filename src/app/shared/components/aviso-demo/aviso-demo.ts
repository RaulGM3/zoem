import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AVISO_DEMO_SIN_ENVIOS, esEmpresaDemo } from '../../../core/planes/demo';
import { PlanService } from '../../../core/planes/plan.service';
import { CompanyService } from '../../../core/services/company.service';

/** Franja fija en el despacho de ejemplo: datos ficticios y sin efectos externos. */
@Component({
  selector: 'app-aviso-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (esDemo()) {
      <div role="status"
        class="border-b border-violet-300 bg-violet-100 px-4 py-2 text-sm text-violet-950 lg:px-6 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-100">
        <strong>Despacho de ejemplo.</strong> Los datos son ficticios. {{ aviso }}
        @if (dias() > 0) { Quedan <strong>{{ dias() }} {{ dias() === 1 ? 'día' : 'días' }}</strong> de prueba. }
      </div>
    }
  `,
})
export class AvisoDemoComponent {
  private readonly company = inject(CompanyService);
  private readonly plan = inject(PlanService);
  protected readonly dias = this.plan.diasDemoRestantes;
  protected readonly aviso = AVISO_DEMO_SIN_ENVIOS;
  protected readonly esDemo = computed(() => esEmpresaDemo(this.company.activeCompany()));
}
