import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { estadoCupo } from '../../../core/planes/derechos';

/** Medidor "3/5 plantillas". Presentacional; el aviso va por texto además de color. */
@Component({
  selector: 'app-cupo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="flex min-w-40 flex-col gap-1 text-xs" [attr.data-estado]="estado()">
        <div class="flex items-center justify-between gap-2" style="color:var(--text-body)">
          <span>{{ usado() }}/{{ limite() }} {{ etiqueta() }}</span>
          @if (estado() === 'aviso') { <span class="font-semibold" style="color:var(--warning-text, #92400e)">Casi al límite</span> }
          @if (estado() === 'agotado') { <span class="font-semibold" style="color:var(--danger-text, #b91c1c)">Límite alcanzado</span> }
        </div>
        <div role="progressbar" [attr.aria-label]="'Uso de ' + etiqueta()" aria-valuemin="0"
          [attr.aria-valuenow]="usado()" [attr.aria-valuemax]="limite()"
          class="h-1.5 w-full overflow-hidden rounded-full" style="background:var(--surface-2)">
          <div class="h-full rounded-full transition-[width]" [style.width.%]="porcentaje()"
            [style.background]="color()"></div>
        </div>
      </div>
    }
  `,
})
export class CupoComponent {
  readonly etiqueta = input.required<string>();
  readonly usado = input.required<number>();
  /** `Infinity` = ilimitado (no se pinta). */
  readonly limite = input.required<number>();

  protected readonly visible = computed(() => Number.isFinite(this.limite()));
  protected readonly estado = computed(() => estadoCupo(this.usado(), this.limite()));
  protected readonly porcentaje = computed(() =>
    this.limite() > 0 ? Math.min(100, (this.usado() / this.limite()) * 100) : 100,
  );
  protected readonly color = computed(() =>
    this.estado() === 'agotado' ? '#dc2626' : this.estado() === 'aviso' ? '#d97706' : 'var(--brand)',
  );
}
