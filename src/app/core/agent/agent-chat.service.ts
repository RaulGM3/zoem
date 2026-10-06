import { inject, Injectable, signal } from '@angular/core';
import type { Content, EnhancedGenerateContentResponse, FunctionCall, GenerativeModel } from 'firebase/ai';
import { AiService } from '../services/ai.service';
import { esSaturacion, mensajeDeError } from './errores-ia';
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

/**
 * Pausas antes de cada reintento cuando el modelo responde 429/503. Dos
 * intentos más, con espera creciente: suficiente para pasar un pico de cuota
 * sin dejar al usuario mirando los puntitos más de unos segundos extra.
 */
export const ESPERAS_REINTENTO_MS = [1500, 4000] as const;

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
- Para cualquier pregunta sobre cómo se usa Vertey ("¿cómo hago…?", "¿dónde está…?", "¿para qué sirve…?"), llama primero a consultar_ayuda y responde SOLO con lo que devuelva, citando los nombres de los botones tal cual. Nunca expliques pasos de memoria. Si no devuelve ninguna guía, dilo y sugiere la página Ayuda. Si el usuario no tiene acceso, dile que lo pida a su administrador. Después de explicar, ofrece llevarle a la pantalla con navegar.
- Responde en español, breve y concreto.`;

@Injectable({ providedIn: 'root' })
export class AgentChatService {
  private readonly ai = inject(AiService);
  private readonly registry = inject(AgentToolRegistry);

  readonly mensajes = signal<ChatMensaje[]>([]);
  readonly pensando = signal(false);
  readonly error = signal<string | null>(null);

  /** Última petición fallida, para poder repetirla tal cual. */
  private pendiente: { texto: string; opts: SendOptions } | null = null;
  readonly puedeReintentar = signal(false);

  limpiar(): void {
    this.mensajes.set([]);
    this.olvidarFallo();
  }

  async send(texto: string, opts: SendOptions = {}): Promise<void> {
    const mensaje = texto.trim();
    if (!mensaje || this.pensando()) return;

    this.olvidarFallo();
    const historial = this.historial();
    this.push(mensaje, false);
    this.pensando.set(true);

    // Fuera del try: si el fallo llega después de ejecutar tools, hay que saberlo.
    const acciones: string[] = [];
    try {
      await this.conversar(mensaje, historial, opts, acciones);
    } catch (e) {
      console.error('[agente] el modelo ha fallado', e);
      this.informarFallo(e, acciones, { texto: mensaje, opts });
    } finally {
      this.pensando.set(false);
    }
  }

  /**
   * Repite la última pregunta fallida. Quita antes la burbuja del usuario que
   * se quedó sin respuesta: `send` la vuelve a pintar.
   */
  async reintentar(): Promise<void> {
    const pendiente = this.pendiente;
    if (!pendiente || this.pensando()) return;

    const ultimo = this.mensajes().at(-1);
    if (ultimo && !ultimo.entrante && ultimo.texto === pendiente.texto) {
      this.mensajes.update((prev) => prev.slice(0, -1));
    }
    await this.send(pendiente.texto, pendiente.opts);
  }

  /**
   * Dos fallos distintos según si el agente llegó a TOCAR la pantalla:
   *
   * - Sin acciones: no pasó nada, así que se avisa en el banner y se ofrece
   *   reintentar. No se añade burbuja: el mismo error dos veces es ruido.
   * - Con acciones: la tool ya abrió o rellenó algo. Reintentar la repetiría,
   *   así que NO se ofrece; se deja constancia en la conversación con las
   *   acciones hechas para que el usuario revise antes de volver a pedirlo.
   */
  private informarFallo(e: unknown, acciones: string[], peticion: { texto: string; opts: SendOptions }): void {
    const motivo = mensajeDeError(e);
    if (acciones.length) {
      this.push(
        `He empezado con tu petición, pero me he cortado antes de terminar. ${motivo} ` +
          'Revisa la pantalla antes de volver a pedírmelo.',
        true,
        acciones,
      );
      return;
    }
    this.error.set(motivo);
    this.pendiente = peticion;
    this.puedeReintentar.set(true);
  }

  private olvidarFallo(): void {
    this.error.set(null);
    this.pendiente = null;
    this.puedeReintentar.set(false);
  }

  /**
   * Ida y vuelta con el modelo hasta que responda texto o se agote el presupuesto.
   *
   * Lleva el historial a mano con `generateContent` en vez de `startChat`: el
   * `ChatSession` del SDK deja su cola interna rechazada tras un error, así que
   * un 429 a mitad de conversación la inutiliza y no hay forma de reintentar.
   * Con el array propio, reintentar es reenviar exactamente los mismos
   * contenidos — sin volver a ejecutar las tools que ya corrieron.
   */
  private async conversar(
    mensaje: string,
    historial: Content[],
    opts: SendOptions,
    acciones: string[],
  ): Promise<void> {
    const declaraciones = this.registry.declarations({ soloLectura: opts.soloLectura });
    const model = this.ai.getToolModel(declaraciones, this.systemInstruction(opts.contexto));
    const contents: Content[] = [...historial, { role: 'user', parts: [{ text: mensaje }] }];

    let respuesta = await this.generar(model, contents);

    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const llamadas = respuesta.functionCalls() ?? [];
      if (llamadas.length === 0) {
        this.push(respuesta.text(), true, acciones);
        return;
      }
      acciones.push(...llamadas.map((c) => c.name));
      // El turno del modelo va TAL CUAL: con Gemini 3 incluye las firmas de
      // razonamiento, y sin ellas rechaza la respuesta de la tool.
      contents.push(
        respuesta.candidates?.[0]?.content ?? { role: 'model', parts: llamadas.map((functionCall) => ({ functionCall })) },
        await this.ejecutar(llamadas),
      );
      respuesta = await this.generar(model, contents);
    }

    // Presupuesto agotado: si aun así vino texto lo aprovechamos, si no avisamos.
    const texto = (respuesta.functionCalls() ?? []).length ? SIN_SALIDA : respuesta.text();
    this.push(texto || SIN_SALIDA, true, acciones);
  }

  /** Una llamada al modelo, reintentada solo si el fallo es de saturación. */
  private async generar(model: GenerativeModel, contents: Content[]): Promise<EnhancedGenerateContentResponse> {
    for (let intento = 0; ; intento++) {
      try {
        // Copia: `contents` sigue creciendo y la llamada debe ver solo lo de ahora.
        return (await model.generateContent({ contents: [...contents] })).response;
      } catch (e) {
        const espera = ESPERAS_REINTENTO_MS[intento];
        if (espera === undefined || !esSaturacion(e)) throw e;
        await new Promise((r) => setTimeout(r, espera));
      }
    }
  }

  /** Ejecuta en paralelo todas las tools de un turno; ninguna puede lanzar. */
  private async ejecutar(llamadas: FunctionCall[]): Promise<Content> {
    const parts = await Promise.all(
      llamadas.map(async (call) => ({
        functionResponse: {
          name: call.name,
          response: (await this.registry.run(call.name, (call.args ?? {}) as ToolArgs)).data,
        },
      })),
    );
    return { role: 'function', parts };
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
