import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Funcion, PlanId } from '../../../core/planes/catalogo';
import { PLANES_INFO, textosMejora } from '../../../core/planes/textos-mejora';
import { OverlayShellComponent } from '../overlay-shell/overlay-shell';

/**
 * Modal de comparación de planes. Presentacional: no sabe cómo se paga; emite
 * `solicitar(plan)` y el contenedor decide (hoy un aviso, en la fase 4 Stripe Checkout).
 */
@Component({
  selector: 'app-mejorar-plan-modal',
  imports: [OverlayShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-overlay-shell [open]="open()" variant="modal" size="lg" title="Mejora tu plan"
      [subtitle]="subtitulo()" (closed)="closed.emit()">
      <div class="grid gap-3 px-5 py-4 sm:grid-cols-3">
        @for (p of planes; track p.id) {
          <section class="flex flex-col gap-3 rounded-2xl p-4 text-sm"
            [attr.aria-labelledby]="'plan-' + p.id"
            style="border:1px solid var(--border);background:var(--surface)">
            <div>
              <h3 [id]="'plan-' + p.id" class="text-base font-semibold" style="color:var(--text-strong)">{{ p.nombre }}</h3>
              <p class="text-xs" style="color:var(--text-muted)">{{ p.resumen }}</p>
            </div>
            <ul class="flex-1 list-disc space-y-1 pl-4" style="color:var(--text-body)">
              @for (pt of p.puntos; track pt) { <li>{{ pt }}</li> }
            </ul>
            @if (p.id === planActual()) {
              <p class="text-xs font-semibold" style="color:var(--text-strong)">Tu plan actual</p>
            } @else if (p.id !== 'free') {
              <button type="button" [attr.data-solicitar]="p.id" (click)="solicitar.emit(p.id)"
                class="tap-target min-h-11 rounded-xl bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2">
                {{ p.id === 'enterprise' ? 'Contactar' : 'Quiero Pro' }}
              </button>
            }
          </section>
        }
      </div>
    </app-overlay-shell>
  `,
})
export class MejorarPlanModalComponent {
  protected readonly planes = PLANES_INFO;

  readonly open = input.required<boolean>();
  readonly planActual = input.required<PlanId>();
  readonly funcion = input<Funcion | null>(null);

  readonly closed = output<void>();
  readonly solicitar = output<PlanId>();

  protected readonly subtitulo = computed(() => {
    const f = this.funcion();
    return f ? `Desbloquea ${textosMejora(f).titulo} y mucho más` : 'Elige el plan que mejor encaja con tu despacho';
  });
}
