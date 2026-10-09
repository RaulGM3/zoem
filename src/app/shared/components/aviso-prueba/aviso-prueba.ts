import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { claveDia, debeMostrarAvisoPrueba } from '../../../core/planes/aviso-prueba';
import { MejoraPlanService } from '../../../core/planes/mejora-plan.service';
import { PlanService } from '../../../core/planes/plan.service';

/** localStorage (por navegador): día (yyyy-mm-dd) en que se cerró el aviso. */
export const CLAVE_AVISO_PRUEBA = 'zoem.avisoPrueba.descartado';

function leer(): string | null {
  try {
    return localStorage.getItem(CLAVE_AVISO_PRUEBA);
  } catch {
    return null;
  }
}

/** Aviso de fin de prueba (≤3 días). Descartable; reaparece al día siguiente. */
@Component({
  selector: 'app-aviso-prueba',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div role="status"
        class="flex items-center gap-3 border-b border-sky-300 bg-sky-100 px-4 py-2 text-sm text-sky-950 lg:px-6 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-100">
        <p class="min-w-0 flex-1">
          Tu prueba con todo desbloqueado termina en <strong>{{ dias() }} {{ dias() === 1 ? 'día' : 'días' }}</strong>.
          Después pasarás al plan gratuito; no se borra ningún dato.
        </p>
        <button type="button" (click)="mejora.abrir()"
          class="tap-target shrink-0 rounded-lg px-2.5 py-1 font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
          Mejorar plan
        </button>
        <button type="button" aria-label="Cerrar aviso" (click)="descartar()"
          class="tap-target inline-flex shrink-0 items-center rounded-lg p-1 hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 dark:hover:bg-sky-500/25">
          <lucide-icon [img]="XIcon" [size]="16" aria-hidden="true" />
        </button>
      </div>
    }
  `,
})
export class AvisoPruebaComponent {
  private readonly plan = inject(PlanService);
  protected readonly mejora = inject(MejoraPlanService);
  protected readonly XIcon = X;

  private readonly descartadoEl = signal<string | null>(leer());
  protected readonly dias = computed(() => this.plan.diasPruebaRestantes());
  protected readonly visible = computed(() =>
    debeMostrarAvisoPrueba({
      enPrueba: this.plan.enPrueba(),
      dias: this.dias(),
      descartadoEl: this.descartadoEl(),
      hoy: claveDia(this.plan.ahora()),
    }),
  );

  protected descartar(): void {
    const hoy = claveDia(this.plan.ahora());
    this.descartadoEl.set(hoy);
    try {
      localStorage.setItem(CLAVE_AVISO_PRUEBA, hoy);
    } catch {
      // Sin storage el descarte dura hasta recargar.
    }
  }
}
