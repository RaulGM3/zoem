import type { EsquemaObjeto } from './esquema';
import type { Capability, Modulo } from '../permissions/permissions';

/**
 * Contrato de una herramienta del agente — el PUERTO de la arquitectura.
 *
 * Una tool no sabe quién la invoca: puede ser el chat de texto, el de voz o,
 * el día de mañana, un servidor MCP. Por eso no toca el DOM ni conoce Gemini:
 * declara qué hace, qué permiso necesita y cómo ejecutarse. Nada más.
 */

/** Argumentos que el modelo rellena. Llegan SIN validar: el modelo puede alucinar. */
export type ToolArgs = Record<string, unknown>;

export interface ToolResult {
  ok: boolean;
  /** Lo que vuelve al modelo como `functionResponse`. Debe ser JSON serializable. */
  data: Record<string, unknown>;
  /** Texto opcional para pintar una tarjeta en el chat, aparte de lo que diga el modelo. */
  display?: string;
}

export interface AgentTool<A extends ToolArgs = ToolArgs> {
  /** Identificador que ve el modelo. snake_case en español: así lo elige mejor. */
  readonly name: string;
  /** Descripción en español — esto ES prompt, no documentación. Sé explícito. */
  readonly description: string;
  /** Esquema de los argumentos. Ausente = tool sin parámetros. */
  readonly parameters?: EsquemaObjeto;
  /** Permiso exigido. Ausente = disponible para cualquier usuario autenticado. */
  readonly permission?: { modulo: Modulo; cap: Capability };
  execute(args: A): Promise<ToolResult> | ToolResult;
}

export const toolOk = (data: Record<string, unknown>, display?: string): ToolResult => ({
  ok: true,
  data,
  display,
});

/** Un fallo NO es una excepción: el modelo necesita leerlo para poder reaccionar. */
export const toolFail = (error: string): ToolResult => ({ ok: false, data: { error } });
