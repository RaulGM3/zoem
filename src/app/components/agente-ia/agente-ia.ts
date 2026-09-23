import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgenteChatComponent } from './agente-chat';

/**
 * Página del agente (`/agente-ia`): el chat a pantalla completa.
 *
 * Es solo una CARCASA. Toda la conversación vive en `AgenteChatComponent`, que
 * comparte con el panel flotante del lanzador. Lo único que aporta esta página
 * es la altura: el `4rem` descuenta la cabecera del layout.
 */
@Component({
  selector: 'app-agente-ia',
  imports: [AgenteChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-agente-chat class="h-[calc(100vh-4rem)]" />`,
})
export class AgenteIAComponent {}
