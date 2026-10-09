import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, input, output, viewChild } from '@angular/core';
import type { Funcion, PlanId } from '../../../core/planes/catalogo';
import type { MotivoBloqueo } from '../../../core/planes/bloqueo';
import { ZONA_POR_DEFECTO } from '../../../core/planes/periodo';
import { textosBloqueo } from '../../../core/planes/textos-bloqueo';
import { PLANES_INFO, textosMejora } from '../../../core/planes/textos-mejora';
import { CupoComponent } from '../cupo/cupo';
import { OverlayShellComponent } from '../overlay-shell/overlay-shell';

const ETIQUETA_CUPO: Record<string, string> = {
  casosActivos: 'casos activos', contactos: 'contactos', plantillas: 'plantillas', usuarios: 'usuarios',
  accionesMes: 'acciones este mes', iaMensajesMes: 'mensajes de IA este mes', documentosMB: 'MB de documentos',
};

/**
 * Modal de comparación de planes. Presentacional: no sabe cómo se paga; emite
 * `solicitar(plan)` y el contenedor decide (hoy un aviso, en la fase 4 Stripe Checkout).
 */
@Component({
  selector: 'app-mejorar-plan-modal',
  imports: [OverlayShellComponent, CupoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-overlay-shell [open]="open()" variant="modal" size="lg" title="Mejora tu plan"
      [subtitle]="subtitulo()" (closed)="closed.emit()">
      @if (textoBloqueo(); as t) {
        <section class="flex flex-col gap-3 px-5 pt-4" data-testid="causa-bloqueo">
          <h3 #titular data-testid="titular-bloqueo" tabindex="-1" class="text-lg font-semibold outline-none"
            style="color:var(--text-strong);font-family:var(--font-display)">{{ t.titulo }}</h3>
          <p class="text-sm" style="color:var(--text-body)">{{ t.descripcion }}</p>
          @if (medidor(); as m) {
            <app-cupo [etiqueta]="m.etiqueta" [usado]="m.usado" [limite]="m.limite" />
          }
          <div class="flex flex-wrap gap-2">
            <button type="button" (click)="solicitar.emit('pro')"
              class="tap-target min-h-11 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2">
              {{ t.cta }}
            </button>
            <button type="button" (click)="closed.emit()"
              class="tap-target min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-2)] focus:outline-none focus-visible:ring-2"
              style="color:var(--text-body);border:1px solid var(--border)">
              {{ t.ctaSecundaria }}
            </button>
          </div>
        </section>
      }
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

  /** Causa concreta del bloqueo; si falta, el modal es la comparación de planes genérica. */
  readonly motivo = input<MotivoBloqueo | null>(null);
  readonly zona = input<string>(ZONA_POR_DEFECTO);
  /** Reloj del contenedor (para la fecha de renovación). */
  readonly ahora = input<Date | null>(null);

  private readonly titular = viewChild<ElementRef<HTMLElement>>('titular');

  readonly closed = output<void>();
  readonly solicitar = output<PlanId>();

  constructor() {
    // El diálogo abre con el foco en su primer control; con causa, el titular lo anuncia primero.
    afterNextRender(() => this.titular()?.nativeElement.focus());
  }

  protected readonly textoBloqueo = computed(() => {
    const m = this.motivo();
    return m ? textosBloqueo(m, { plan: this.planActual(), ahora: this.ahora() ?? new Date(), zona: this.zona() }) : null;
  });

  protected readonly medidor = computed(() => {
    const m = this.motivo();
    if (m?.tipo !== 'cupo' || m.limite === undefined || !Number.isFinite(m.limite)) return null;
    return { etiqueta: ETIQUETA_CUPO[m.recurso] ?? String(m.recurso), usado: m.usado ?? 0, limite: m.limite };
  });

  protected readonly subtitulo = computed(() => {
    const f = this.funcion();
    return f ? `Desbloquea ${textosMejora(f).titulo} y mucho más` : 'Elige el plan que mejor encaja con tu despacho';
  });
}
