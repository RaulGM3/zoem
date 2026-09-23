import { inject, Injectable, signal } from '@angular/core';
import type { Content, FunctionCall, Part } from 'firebase/ai';
import { AiService } from '../services/ai.service';
import { AgentToolRegistry } from './agent-tool-registry';
import type { ToolArgs } from './agent-tool';

/**
 * Loop de conversación con herramientas — el ADAPTADOR de texto.
 *
 * Su única responsabilidad es orquestar el ida y vuelta con el modelo: mandar
 * el mensaje, ejecutar las tools que pida vía registry, devolverle los
 * resultados y repetir hasta que responda en lenguaje natural.
 *
 * No conoce ninguna tool concreta ni ninguna pantalla. El día que se sume voz,
 * el adaptador de voz llama a este mismo `send()`.
 */

/**
 * Tope de rondas modelo→tools→modelo. Sin él, un modelo que se obceca en llamar
 * herramientas deja el chat colgado quemando tokens. Cinco alcanza de sobra para
 * "busca el caso → ábrelo" y corta en seco cualquier bucle.
 */
export const MAX_VUELTAS = 5;

const SIN_SALIDA =
  'Lo siento, no he podido completar la petición: me he quedado dando vueltas. ' +
  '¿Puedes reformularla con algo más de detalle?';

export interface ChatMensaje {
  id: string;
  texto: string;
  /** `true` = lo dijo el agente; `false` = lo escribió el usuario. */
  entrante: boolean;
  hora: string;
  /** Nombres de las tools ejecutadas para producir esta respuesta. */
  acciones?: string[];
}

export interface SendOptions {
  /** Modo consulta: el registry esconde las tools que escriben. */
  soloLectura?: boolean;
  /** Contexto vivo (ruta actual, rol, empresa) que se inyecta al system prompt. */
  contexto?: string;
}

const BASE_PROMPT = `Eres el asistente de Vertey, un software de gestión para despachos profesionales.
Ayudas al usuario a encontrar información y a preparar acciones dentro de la propia aplicación.

Reglas que NO puedes romper:
- Nunca inventes datos ni identificadores. Si necesitas un caso o un contacto concreto, búscalo primero con la herramienta correspondiente.
- Si una búsqueda devuelve varios candidatos, pregunta al usuario cuál quiere en vez de elegir tú.
- Si una búsqueda no devuelve nada, dilo con claridad; no rellenes el hueco.
- Tú NO guardas nada. Las herramientas de creación solo dejan el formulario abierto y relleno: el usuario revisa y confirma. Nunca digas que has creado, guardado o modificado algo; di que lo has dejado preparado.
- Responde en español, breve y concreto.`;

@Injectable({ providedIn: 'root' })
export class AgentChatService {
  private readonly ai = inject(AiService);
  private readonly registry = inject(AgentToolRegistry);

  readonly mensajes = signal<ChatMensaje[]>([]);
  readonly pensando = signal(false);
  readonly error = signal<string | null>(null);

  limpiar(): void {
    this.mensajes.set([]);
    this.error.set(null);
  }

  async send(texto: string, opts: SendOptions = {}): Promise<void> {
    const mensaje = texto.trim();
    if (!mensaje || this.pensando()) return;

    this.error.set(null);
    const historial = this.historial();
    this.push(mensaje, false);
    this.pensando.set(true);

    try {
      await this.conversar(mensaje, historial, opts);
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e);
      this.error.set(detalle);
      this.push(`No he podido contactar con el asistente. Detalle: ${detalle}`, true);
    } finally {
      this.pensando.set(false);
    }
  }

  /** Ida y vuelta con el modelo hasta que responda texto o se agote el presupuesto. */
  private async conversar(mensaje: string, historial: Content[], opts: SendOptions): Promise<void> {
    const declaraciones = this.registry.declarations({ soloLectura: opts.soloLectura });
    const model = this.ai.getToolModel(declaraciones, this.systemInstruction(opts.contexto));
    const chat = model.startChat({ history: historial });

    let respuesta = (await chat.sendMessage(mensaje)).response;
    const acciones: string[] = [];

    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const llamadas = respuesta.functionCalls() ?? [];
      if (llamadas.length === 0) {
        this.push(respuesta.text(), true, acciones);
        return;
      }
      acciones.push(...llamadas.map((c) => c.name));
      respuesta = (await chat.sendMessage(await this.ejecutar(llamadas))).response;
    }

    // Presupuesto agotado: si aun así vino texto lo aprovechamos, si no avisamos.
    const texto = (respuesta.functionCalls() ?? []).length ? SIN_SALIDA : respuesta.text();
    this.push(texto || SIN_SALIDA, true, acciones);
  }

  /** Ejecuta en paralelo todas las tools de un turno; ninguna puede lanzar. */
  private async ejecutar(llamadas: FunctionCall[]): Promise<Part[]> {
    return Promise.all(
      llamadas.map(async (call) => ({
        functionResponse: {
          name: call.name,
          response: (await this.registry.run(call.name, (call.args ?? {}) as ToolArgs)).data,
        },
      })),
    );
  }

  private systemInstruction(contexto?: string): string {
    return contexto ? `${BASE_PROMPT}\n\nContexto actual:\n${contexto}` : BASE_PROMPT;
  }

  /**
   * Historial para el modelo reconstruido a partir de lo que ve el usuario.
   * Las llamadas a herramientas NO se reinyectan: su resultado ya quedó
   * resumido en el texto de la respuesta, y arrastrarlas hincha el prompt.
   */
  private historial(): Content[] {
    return this.mensajes().map((m) => ({
      role: m.entrante ? 'model' : 'user',
      parts: [{ text: m.texto }],
    }));
  }

  private push(texto: string, entrante: boolean, acciones: string[] = []): void {
    this.mensajes.update((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        texto,
        entrante,
        hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        ...(acciones.length ? { acciones } : {}),
      },
    ]);
  }
}
