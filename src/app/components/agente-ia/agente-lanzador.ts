import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { Bot, LucideAngularModule } from 'lucide-angular';
import { AgentePanelComponent } from './agente-panel';

/**
 * Botón flotante del agente, presente en toda el área autenticada.
 *
 * Este es el ÚNICO archivo del agente que entra en el bundle del layout, y por
 * eso es deliberadamente pobre: signals, el Router y un icono. No inyecta
 * `AgentChatService`, no toca `core/voz` y no sabe nada de Gemini.
 *
 * Abre el chat DIRECTAMENTE, sin menú intermedio: hablar o escribir ya se
 * decide dentro, donde están el textarea y el micro. Un paso menos.
 *
 * `AgentePanelComponent` se usa EXCLUSIVAMENTE dentro del bloque `@defer`. Esa
 * es la condición que hace que Angular lo compile como import dinámico. Si
 * apareciera una sola vez fuera del bloque, el compilador lo metería en este
 * mismo chunk y el usuario volvería a descargar el agente entero sin pedirlo,
 * SIN ningún error que lo delate. No lo saques de ahí.
 *
 * El disparador es el propio botón (`on interaction(fab)`), no el placeholder:
 * así el botón vive fuera del bloque y no desaparece al cargarse el panel.
 * `prefetch on hover` adelanta la descarga en escritorio; en móvil no hay hover,
 * así que allí no se descarga nada hasta el toque.
 */
@Component({
  selector: 'app-agente-lanzador',
  imports: [LucideAngularModule, AgentePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!oculto()) {
      <button
        #fab
        type="button"
        data-test="fab"
        (click)="alternar()"
        [attr.aria-expanded]="abierto()"
        [attr.aria-label]="abierto() ? 'Cerrar el asistente Vertey IA' : 'Abrir el asistente Vertey IA'"
        class="fixed bottom-6 right-6 z-30 w-14 h-14 flex items-center justify-center rounded-full
               text-white shadow-lg transition-transform hover:scale-105
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
               focus-visible:ring-violet-500"
        style="background:var(--accent-ia)"
      >
        <lucide-icon [img]="BotIcon" class="w-6 h-6" aria-hidden="true" />
      </button>

      @defer (on interaction(fab); prefetch on hover(fab)) {
        @if (abierto()) {
          <app-agente-panel (cerrado)="cerrar()" />
        }
      }
    }
  `,
})
export class AgenteLanzadorComponent {
  private readonly router = inject(Router);

  readonly BotIcon = Bot;

  readonly abierto = signal(false);

  /**
   * `router.url` no es reactivo, así que se sigue la navegación. El valor
   * inicial cubre el primer render, antes de que llegue ningún `NavigationEnd`.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** En `/agente-ia` ya está el chat a pantalla completa: dos agentes sobran. */
  readonly oculto = computed(() => this.url().startsWith('/agente-ia'));

  alternar(): void {
    this.abierto.update((v) => !v);
  }

  /**
   * Cerrar DESTRUYE el panel, no lo esconde: así `appFocusTrap` devuelve el
   * foco al botón flotante al desmontarse. El historial no se pierde porque
   * vive en `AgentChatService`, que es singleton de raíz.
   */
  cerrar(): void {
    this.abierto.set(false);
  }
}
