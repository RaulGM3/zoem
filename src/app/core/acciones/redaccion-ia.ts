import type { Canal } from '../../interfaces/accion.interface';
import { VARIABLES_ACCION } from './insertar-variable';

export type FormatoRedaccion = 'email' | 'whatsapp';

/**
 * `plantilla`: texto reutilizable con `{{variables}}`, sin datos personales.
 * `mensaje`: texto final para un contacto/caso concreto, con su contexto.
 */
export type ModoRedaccion = 'plantilla' | 'mensaje';

export interface TextoRedactado {
  asunto: string;
  cuerpo: string;
}

export interface SolicitudRedaccion {
  modo: ModoRedaccion;
  formato: FormatoRedaccion;
  /** Lo que el usuario explica que quiere decir. */
  instrucciones: string;
  /** Solo en modo `mensaje`: salida de `construirContextoAccion`. */
  contexto?: Record<string, string>;
  /** Texto actual del formulario, como punto de partida. */
  borrador?: TextoRedactado;
}

/** WhatsApp solo si es el ÚNICO destino: una plantilla con email y WhatsApp se redacta como email. */
export function formatoParaCanales(canales: readonly Canal[]): FormatoRedaccion {
  return canales.length > 0 && canales.every((c) => c === 'whatsapp') ? 'whatsapp' : 'email';
}

/**
 * Claves del contexto que pueden llegar a Gemini. Minimización (RGPD): el email
 * y el teléfono no aportan nada a la redacción, y los alias (`nombre`,
 * `contacto`, `hoy`) solo duplicarían datos.
 */
const CLAVES_IA = ['cliente', 'caso', 'asunto', 'tipo', 'descripcion', 'vencimiento', 'hito', 'hito_descripcion', 'empresa', 'fecha'];

export function contextoParaIa(contexto: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const k of CLAVES_IA) {
    const v = contexto[k]?.trim();
    if (v) r[k] = v;
  }
  return r;
}

const ESTILO: Record<FormatoRedaccion, string> = {
  email: `Formato EMAIL: tono profesional y cordial, con saludo y despedida. "asunto": claro y concreto (máx. 80 caracteres). "cuerpo": párrafos breves separados por una línea en blanco.`,
  whatsapp: `Formato WhatsApp: tono cercano pero profesional, mensaje BREVE (máx. 600 caracteres), sin despedidas formales ni firma. "asunto": un título muy corto (máx. 6 palabras) que se mostrará en negrita encima del mensaje. "cuerpo": una o dos frases cortas; puedes usar *negrita* de WhatsApp con moderación. Sin emojis salvo que se pidan.`,
};

/** Prompt único: las instrucciones del usuario van delimitadas para que no se confundan con las reglas. */
export function construirPromptRedaccion(s: SolicitudRedaccion): string {
  const partes = [
    `Eres un asistente que redacta comunicaciones de un despacho profesional español a sus clientes. Escribe en español de España.`,
    ESTILO[s.formato],
  ];

  if (s.modo === 'plantilla') {
    const vars = VARIABLES_ACCION.map((v) => `{{${v.key}}} (${v.label})`).join(', ');
    partes.push(
      `Redacta una PLANTILLA reutilizable. No conoces al destinatario: donde haga falta un dato concreto usa EXCLUSIVAMENTE estas variables, escritas tal cual con dobles llaves: ${vars}. No inventes otras variables ni datos.`,
    );
  } else {
    const ctx = contextoParaIa(s.contexto ?? {});
    const lineas = Object.entries(ctx).map(([k, v]) => `- ${k}: ${v}`);
    partes.push(
      `Redacta el mensaje FINAL para este destinatario. Usa estos datos cuando sean relevantes y no inventes otros (ni importes, ni fechas, ni enlaces):\n${lineas.join('\n') || '- (sin datos)'}`,
    );
  }

  const b = s.borrador;
  if (b && (b.asunto.trim() || b.cuerpo.trim())) {
    partes.push(`Borrador actual (úsalo como base si encaja con lo pedido):\nAsunto: ${b.asunto.trim()}\nCuerpo:\n${b.cuerpo.trim()}`);
  }

  partes.push(`Lo que el usuario quiere comunicar:\n"""\n${s.instrucciones.trim()}\n"""`);
  partes.push(`Devuelve EXCLUSIVAMENTE JSON con "asunto" y "cuerpo" (texto plano, sin HTML ni Markdown salvo la negrita de WhatsApp).`);
  return partes.join('\n\n');
}

/** Valida la respuesta de Gemini; `null` si no trae un cuerpo usable. */
export function normalizarRedaccion(raw: unknown): TextoRedactado | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const asunto = typeof o['asunto'] === 'string' ? o['asunto'].trim() : '';
  const cuerpo = typeof o['cuerpo'] === 'string' ? o['cuerpo'].trim() : '';
  return cuerpo ? { asunto, cuerpo } : null;
}
