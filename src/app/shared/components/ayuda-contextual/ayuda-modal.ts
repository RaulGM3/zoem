import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Guia } from '../../../core/ayuda/guia';
import { OverlayShellComponent } from '../overlay-shell/overlay-shell';

/**
 * Modal de ayuda de una pantalla. Presentacional: proyecta la guía que recibe y
 * no sabe de dónde sale. El contenido vive en `core/ayuda/guias`; este componente
 * solo lo pinta, así que cualquier pantalla puede reutilizarlo con su guía.
 */
@Component({
  selector: 'app-ayuda-modal',
  imports: [OverlayShellComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-overlay-shell [open]="open()" variant="modal" size="lg"
      [title]="guia()?.titulo ?? 'Ayuda'" subtitle="Ayuda de esta pantalla" (closed)="closed.emit()">
      <div class="space-y-5 px-5 py-4 text-sm" style="color:var(--text-body)">
        @if (cargando()) {
          <p role="status">Cargando ayuda…</p>
        } @else if (error()) {
          <div role="alert" class="space-y-3">
            <p>No se pudo cargar la ayuda. Comprueba tu conexión.</p>
            <button type="button" (click)="reintentar.emit()"
              class="min-h-11 rounded-xl px-3 py-2 font-medium"
              style="border:1px solid var(--border);color:var(--text-strong);background:var(--surface)">
              Reintentar
            </button>
          </div>
        } @else if (guia(); as g) {
          <section aria-labelledby="ayuda-modal-que" class="space-y-2">
            <h3 id="ayuda-modal-que" class="font-semibold" style="color:var(--text-strong)">Qué es</h3>
            <p>{{ g.resumen }}</p>
            <p><span class="font-semibold" style="color:var(--text-strong)">Para qué sirve:</span> {{ g.paraQue }}</p>
          </section>

          @if (g.aSaber?.length) {
            <section aria-labelledby="ayuda-modal-saber" class="space-y-2 rounded-xl p-4"
              style="background:color-mix(in srgb,var(--brand) 7%,var(--surface-2))">
              <h3 id="ayuda-modal-saber" class="font-semibold" style="color:var(--text-strong)">Lo que tienes que saber</h3>
              <ul data-a-saber class="list-disc space-y-1 pl-5">
                @for (punto of g.aSaber; track $index) {
                  <li>{{ punto }}</li>
                }
              </ul>
            </section>
          }

          @if (g.tareas.length) {
            <section aria-labelledby="ayuda-modal-tareas" class="space-y-2">
              <h3 id="ayuda-modal-tareas" class="font-semibold" style="color:var(--text-strong)">Qué puedes hacer aquí</h3>
              <div class="space-y-2">
                @for (t of g.tareas; track t.id) {
                  <details class="group rounded-xl" style="border:1px solid var(--border)">
                    <summary class="flex min-h-11 cursor-pointer items-center px-3 py-2 font-medium"
                      style="color:var(--text-strong)">{{ t.titulo }}</summary>
                    <div class="px-3 pb-3">
                      <ol class="list-decimal space-y-1 pl-5">
                        @for (paso of t.pasos; track $index) {
                          <li>{{ paso }}</li>
                        }
                      </ol>
                      @if (t.nota) {
                        <p class="mt-2 rounded-xl p-3" style="background:var(--surface-2)">{{ t.nota }}</p>
                      }
                    </div>
                  </details>
                }
              </div>
            </section>
          }
        }
      </div>

      @if (guia(); as g) {
        <div footer class="flex justify-end px-5 py-3">
          <a [routerLink]="['/ayuda', g.id]" (click)="closed.emit()"
            class="inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style="background:var(--brand)">Ver guía completa</a>
        </div>
      }
    </app-overlay-shell>
  `,
})
export class AyudaModalComponent {
  readonly open = input.required<boolean>();
  readonly guia = input<Guia | null>(null);
  readonly cargando = input(false);
  readonly error = input(false);
  readonly closed = output<void>();
  readonly reintentar = output<void>();
}
