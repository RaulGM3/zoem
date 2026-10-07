import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, X, FileText } from 'lucide-angular';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';
import { CANAL_LABELS, type Accion } from '../../../interfaces/accion.interface';

/** Selector de acción: lista las acciones disponibles y emite la elegida. */
@Component({
  selector: 'app-accion-selector',
  imports: [LucideAngularModule, FocusTrapDirective, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4',
    style: 'background:rgba(15,23,41,0.45)',
    '(click)': 'closed.emit()',
  },
  template: `
    <div class="w-full sm:max-w-md max-h-[85dvh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
      style="background:var(--popover);border:1px solid var(--border)"
      (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()"
      role="dialog" aria-modal="true" aria-labelledby="as-title"
      appFocusTrap (escapeKey)="closed.emit()">
      <div class="flex items-center justify-between px-5 py-4 shrink-0" style="border-bottom:1px solid var(--border)">
        <h2 id="as-title" class="text-base font-semibold"
          style="color:var(--text-strong);font-family:var(--font-display)">{{ titulo() }}</h2>
        <button type="button" (click)="closed.emit()" aria-label="Cerrar"
          class="rounded-xl p-2 min-w-11 min-h-11 flex items-center justify-center" style="color:var(--text-muted)">
          <lucide-icon [img]="XIcon" size="18"></lucide-icon>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        @if (cargando() && acciones().length === 0) {
          <p role="status" class="text-sm" style="color:var(--text-faint)">Cargando acciones...</p>
        } @else if (acciones().length === 0) {
          <div class="text-sm space-y-2" style="color:var(--text-muted)">
            <p>No hay acciones disponibles para este caso de uso.</p>
            @if (puedeGestionar()) {
              <a routerLink="/acciones" class="underline min-h-11 inline-flex items-center" style="color:var(--brand)">
                Crear una acción en Configuración
              </a>
            }
          </div>
        } @else {
          <ul class="space-y-2">
            @for (a of acciones(); track a.id) {
              <li>
                <button type="button" data-testid="opcion-accion" (click)="elegida.emit(a)"
                  class="w-full text-left rounded-xl p-3 min-h-11 transition-colors"
                  style="border:1px solid var(--border);background:var(--surface-2)">
                  <span class="block font-medium text-sm" style="color:var(--text-strong)">{{ a.nombre }}</span>
                  <span class="block text-xs mt-0.5" style="color:var(--text-muted)">
                    {{ canalesTexto(a) }}
                    @if (a.docTemplateId) {
                      · <lucide-icon [img]="FileTextIcon" class="w-3 h-3 inline -mt-0.5" /> Documento
                    }
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class AccionSelectorComponent {
  readonly acciones = input.required<Accion[]>();
  readonly cargando = input(false);
  readonly puedeGestionar = input(false);
  readonly titulo = input('Elige una acción');

  readonly elegida = output<Accion>();
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly FileTextIcon = FileText;

  canalesTexto(a: Accion): string {
    return a.canales.map((c) => CANAL_LABELS[c]).join(', ');
  }
}
