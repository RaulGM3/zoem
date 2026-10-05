import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgenteChatComponent } from './agente-chat';

/**
 * Página del agente (`/agente-ia`): el chat a pantalla completa.
 *
 * Es solo una CARCASA. Toda la conversación vive en `AgenteChatComponent`, que
 * comparte con el panel flotante del lanzador. Lo único que aporta esta página
 * es la altura (el `4rem` descuenta la cabecera del layout), la tarjeta
 * redondeada y, en móvil, el `-mx-2` que recorta el `p-4` del `<main>` a 8px:
 * margen justo para que se vean las esquinas sin desperdiciar ancho.
 */
@Component({
  selector: 'app-agente-ia',
  imports: [AgenteChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-agente-chat class="-mx-2 lg:mx-0 h-[calc(100vh-4rem)] rounded-2xl overflow-hidden border border-border" />`,
})
export class AgenteIAComponent {}
