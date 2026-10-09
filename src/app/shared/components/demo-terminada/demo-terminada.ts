import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule, Hourglass } from 'lucide-angular';
import { despachoRealAlternativo } from '../../../core/planes/demo-terminada';
import { MejoraPlanService } from '../../../core/planes/mejora-plan.service';
import { CompanyService } from '../../../core/services/company.service';

/**
 * Pantalla que sustituye al contenido cuando el despacho de ejemplo agotó sus 14 días.
 * Los datos se conservan (solo lectura en las rules); aquí se ofrece mejorar el plan o volver al
 * despacho real. Nunca se borra nada.
 */
@Component({
  selector: 'app-demo-terminada',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto flex max-w-xl flex-col items-center gap-5 px-6 py-12 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl"
        style="background:color-mix(in srgb,var(--brand) 12%,var(--surface-2));color:var(--brand)" aria-hidden="true">
        <lucide-icon [img]="HourglassIcon" size="26" />
      </div>
      <div class="space-y-2">
        <h1 class="text-xl font-semibold" style="color:var(--text-strong);font-family:var(--font-display)">
          Tu despacho de ejemplo terminó
        </h1>
        <p class="text-sm" style="color:var(--text-body)">
          Han pasado los 14 días de prueba. Los datos de ejemplo se conservan, pero ya no se puede añadir ni cambiar nada.
          Elige un plan para seguir trabajando con todo desbloqueado.
        </p>
      </div>
      <div class="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
        <button type="button" (click)="mejora.abrir()"
          class="tap-target min-h-11 rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2">
          Ver planes
        </button>
        @if (real(); as r) {
          <button type="button" (click)="ir(r.id)"
            class="tap-target min-h-11 rounded-xl px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style="border:1px solid var(--border);background:var(--surface-2);color:var(--text-strong)">
            Ir a mi despacho: {{ r.nombre }}
          </button>
        }
      </div>
    </section>
  `,
})
export class DemoTerminadaComponent {
  protected readonly HourglassIcon = Hourglass;
  protected readonly mejora = inject(MejoraPlanService);
  private readonly company = inject(CompanyService);

  protected readonly real = computed(() =>
    despachoRealAlternativo(this.company.myMemberships(), this.company.activeCompany()?.id),
  );

  protected ir(id: string): void {
    this.company.cambiarEmpresa(id);
  }
}
