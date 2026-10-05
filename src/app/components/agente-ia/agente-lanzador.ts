import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { Bot, LucideAngularModule } from 'lucide-angular';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { AgentePanelComponent } from './agente-panel';
import { AgenteVozComponent } from './agente-voz';

/** Qué abre el botón: el chat completo o la hoja de dictado (móvil). */
type ModoAgente = 'chat' | 'voz';

/**
 * Botón flotante del agente, presente en toda el área autenticada.
 *
 * Este es el ÚNICO archivo del agente que entra en el bundle del layout, y por
 * eso es deliberadamente pobre: signals, el Router, el breakpoint y un icono. No inyecta
 * `AgentChatService`, no toca `core/voz` y no sabe nada de Gemini.
 *
 * En escritorio abre el chat DIRECTAMENTE, sin menú intermedio. En móvil abre
 * la hoja de dictado (`AgenteVozComponent`): en el teléfono hablar gana a
 * teclear, y desde la hoja se puede pasar al chat completo.
 *
 * `AgentePanelComponent` y `AgenteVozComponent` se usan EXCLUSIVAMENTE dentro
 * del bloque `@defer`. Esa
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
  imports: [LucideAngularModule, AgentePanelComponent, AgenteVozComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!oculto()) {
      <button
        #fab
        type="button"
        data-test="fab"
        (click)="alternar()"
        [attr.aria-expanded]="abierto()"
        [attr.aria-label]="etiqueta()"
        class="fixed z-30 w-14 h-14 flex items-center justify-center rounded-full
               text-on-ia shadow-lg transition-transform hover:scale-105
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
               focus-visible:ring-[var(--accent-ia)] focus-visible:ring-offset-[var(--bg)]"
        style="background:var(--ia-solid);bottom:calc(1.5rem + env(safe-area-inset-bottom, 0px));right:calc(1.5rem + env(safe-area-inset-right, 0px))"
      >
        <lucide-icon [img]="BotIcon" class="w-6 h-6" aria-hidden="true" />
      </button>

      @defer (on interaction(fab); prefetch on hover(fab)) {
        @switch (modo()) {
          @case ('chat') {
            <app-agente-panel (cerrado)="cerrar()" />
          }
          @case ('voz') {
            <app-agente-voz (cerrado)="cerrar()" (verConversacion)="verConversacion()" />
          }
        }
      }
    }
  `,
})
export class AgenteLanzadorComponent {
  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointService);

  readonly BotIcon = Bot;

  readonly modo = signal<ModoAgente | null>(null);
  readonly abierto = computed(() => this.modo() !== null);

  readonly etiqueta = computed(() => {
    if (this.abierto()) return 'Cerrar el asistente Vertey IA';
    return this.breakpoint.isMobile()
      ? 'Dictar al asistente Vertey IA'
      : 'Abrir el asistente Vertey IA';
  });

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
    if (this.abierto()) this.modo.set(null);
    else this.modo.set(this.breakpoint.isMobile() ? 'voz' : 'chat');
  }

  /** Desde la hoja de voz al chat completo, con la conversación ya dentro. */
  verConversacion(): void {
    this.modo.set('chat');
  }

  /**
   * Cerrar DESTRUYE el panel, no lo esconde: así `appFocusTrap` devuelve el
   * foco al botón flotante al desmontarse. El historial no se pierde porque
   * vive en `AgentChatService`, que es singleton de raíz.
   */
  cerrar(): void {
    this.modo.set(null);
  }
}
