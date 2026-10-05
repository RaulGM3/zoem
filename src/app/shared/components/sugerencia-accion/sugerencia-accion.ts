import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Aviso inline y no bloqueante: sugiere notificar al cliente tras completar un hito. */
@Component({
  selector: 'app-sugerencia-accion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div role="status" class="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
      style="background:color-mix(in srgb,var(--brand) 8%,var(--surface));border-bottom:1px solid var(--border)">
      <p class="text-sm" style="color:var(--text-body)">
        ¿Notificar al cliente que «{{ hitoTitulo() }}» está listo?
      </p>
      <div class="flex gap-2">
        <button type="button" (click)="aceptar.emit()"
          class="px-4 min-h-11 text-sm font-semibold text-white rounded-lg" style="background:var(--brand)">
          Notificar
        </button>
        <button type="button" (click)="descartar.emit()"
          class="px-4 min-h-11 text-sm rounded-lg" style="border:1px solid var(--border);color:var(--text-body)">
          Ahora no
        </button>
      </div>
    </div>
  `,
})
export class SugerenciaAccionComponent {
  readonly hitoTitulo = input.required<string>();
  readonly aceptar = output<void>();
  readonly descartar = output<void>();
}
