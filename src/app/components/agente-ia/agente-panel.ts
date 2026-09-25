import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { FocusTrapDirective } from '../../shared/directives/focus-trap.directive';
import { AgenteChatComponent } from './agente-chat';

/**
 * Carcasa flotante del agente: la ventana que abre el lanzador.
 *
 * Vive en el chunk diferido junto al chat, así que NADA de este archivo llega
 * al usuario hasta que pulsa el botón flotante. Por eso el lanzador es un
 * componente aparte y este no se importa jamás fuera del bloque `@defer`.
 *
 * `aria-modal="false"` es deliberado: el agente ACOMPAÑA al trabajo, no lo
 * interrumpe. Sigues pudiendo leer la pantalla que tienes detrás mientras le
 * preguntas por ella — que es justo para lo que sirve.
 *
 * No lleva backdrop por lo mismo. El foco sí se atrapa mientras está abierto
 * (`appFocusTrap`), y al destruirse la directiva lo devuelve al botón que lo
 * abrió; de ahí que cerrar signifique DESTRUIR este componente, no ocultarlo.
 */
@Component({
  selector: 'app-agente-panel',
  imports: [LucideAngularModule, AgenteChatComponent, FocusTrapDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      appFocusTrap
      (escapeKey)="cerrado.emit()"
      role="dialog"
      aria-modal="false"
      aria-label="Asistente Vertey IA"
      class="fixed z-[60] flex flex-col overflow-hidden shadow-2xl
             inset-0
             sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[26rem] sm:h-[min(70vh,40rem)] sm:rounded-2xl"
      style="background:var(--popover);border:1px solid var(--border);color:var(--text)"
    >
      <app-agente-chat class="flex-1 min-h-0">
        <button
          cabecera-extra
          type="button"
          data-test="cerrar-panel"
          (click)="cerrado.emit()"
          aria-label="Cerrar el asistente"
          class="p-2 rounded-lg text-[var(--text-muted)] hover:bg-surface-2 hover:text-[var(--text)]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ia)]"
        >
          <lucide-icon [img]="XIcon" class="w-4 h-4" aria-hidden="true" />
        </button>
      </app-agente-chat>
    </div>
  `,
})
export class AgentePanelComponent {
  readonly XIcon = X;

  readonly cerrado = output<void>();
}
