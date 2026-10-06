import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type VarianteSkeleton = 'lista' | 'tabla' | 'detalle';

/**
 * Placeholder de carga con la forma aproximada del contenido final.
 * Uso: `<app-skeleton variante="tabla" [filas]="6" etiqueta="Cargando casos..." />`
 *
 * - Aparece con 200 ms de retraso (CSS): si los datos llegan antes, no parpadea.
 * - Ocupa su espacio desde el primer frame para no provocar saltos de layout.
 * - Accesible: `role="status"` + `aria-busy` y la etiqueta solo para lectores de pantalla.
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-busy': 'true', class: 'skeleton block' },
  template: `
    <span class="sr-only">{{ etiqueta() }}</span>
    <div [attr.data-skeleton]="variante()" aria-hidden="true">
      @switch (variante()) {
        @case ('tabla') {
          <div class="overflow-hidden rounded-xl" style="border:1px solid var(--border);background:var(--surface)">
            <div class="flex gap-4 px-4 py-3" style="background:var(--surface-2);border-bottom:1px solid var(--border)">
              <div class="bloque h-3 w-1/4"></div>
              <div class="bloque h-3 w-1/6"></div>
              <div class="bloque ml-auto h-3 w-1/6"></div>
            </div>
            @for (i of indices(); track i) {
              <div data-skeleton-fila class="flex items-center gap-4 px-4 py-4" style="border-bottom:1px solid var(--border)">
                <div class="bloque h-3.5 w-1/3"></div>
                <div class="bloque h-3.5 w-1/5"></div>
                <div class="bloque ml-auto h-3.5 w-16"></div>
              </div>
            }
          </div>
        }
        @case ('detalle') {
          <div class="space-y-6">
            <div class="flex items-center gap-3">
              <div class="bloque h-9 w-9 rounded-lg"></div>
              <div class="bloque h-6 w-1/3"></div>
            </div>
            <div class="flex gap-3">
              <div class="bloque h-8 w-24 rounded-lg"></div>
              <div class="bloque h-8 w-24 rounded-lg"></div>
              <div class="bloque h-8 w-24 rounded-lg"></div>
            </div>
            <div class="space-y-3 rounded-xl p-5" style="border:1px solid var(--border);background:var(--surface)">
              @for (i of indices(); track i) {
                <div data-skeleton-fila class="flex gap-4">
                  <div class="bloque h-3.5 w-28"></div>
                  <div class="bloque h-3.5 flex-1"></div>
                </div>
              }
            </div>
          </div>
        }
        @default {
          <div class="space-y-3">
            @for (i of indices(); track i) {
              <div data-skeleton-fila class="flex items-center gap-3 rounded-xl p-4" style="border:1px solid var(--border);background:var(--surface)">
                <div class="bloque h-10 w-10 shrink-0 rounded-full"></div>
                <div class="flex-1 space-y-2">
                  <div class="bloque h-3.5 w-2/5"></div>
                  <div class="bloque h-3 w-3/5"></div>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host { animation: skeleton-aparecer 1ms 200ms both; }
    .bloque {
      border-radius: 6px;
      background: var(--surface-2);
      animation: skeleton-pulso 1.5s ease-in-out infinite;
    }
    @keyframes skeleton-aparecer { from { visibility: hidden; } to { visibility: visible; } }
    @keyframes skeleton-pulso { 50% { opacity: .5; } }
    @media (prefers-reduced-motion: reduce) {
      .bloque { animation: none; }
    }
  `,
})
export class SkeletonComponent {
  readonly variante = input<VarianteSkeleton>('lista');
  readonly filas = input(5);
  readonly etiqueta = input('Cargando…');

  readonly indices = computed(() => Array.from({ length: Math.max(1, this.filas()) }, (_, i) => i));
}
