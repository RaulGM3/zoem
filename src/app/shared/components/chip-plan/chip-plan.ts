import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MejoraPlanService } from '../../../core/planes/mejora-plan.service';
import { PlanService } from '../../../core/planes/plan.service';

/** Etiqueta discreta del plan en el toolbar. Solo Free o prueba; abre el modal de mejora. */
@Component({
  selector: 'app-chip-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (plan.mostrarMejora()) {
      <button type="button" aria-haspopup="dialog" (click)="mejora.abrir()"
        class="tap-target inline-flex min-h-9 items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors hover:bg-[var(--surface-2)] focus:outline-none focus-visible:ring-2"
        style="border:1px solid var(--border);color:var(--text-strong)">
        {{ etiqueta() }}
      </button>
    }
  `,
})
export class ChipPlanComponent {
  protected readonly plan = inject(PlanService);
  protected readonly mejora = inject(MejoraPlanService);

  protected readonly etiqueta = computed(() => {
    if (!this.plan.enPrueba()) return 'Free · Mejorar';
    const d = this.plan.diasPruebaRestantes();
    return `Prueba · ${d} ${d === 1 ? 'día' : 'días'}`;
  });
}
