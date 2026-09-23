/**
 * Guardas de un audio dictado ANTES de mandarlo a Gemini (puro, sin framework).
 *
 * Todas estas comprobaciones existen para no gastar un solo token en un audio
 * que no puede producir una transcripción útil: un clic accidental, un blob
 * vacío o una grabación que se fue de tamaño.
 */

/** Tope de bytes. Mismo criterio que `MAX_PDF_BYTES` en doc-extraction.service: el
 *  límite inline de Gemini son 20MB y base64 infla ~33%. */
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

/**
 * Tope de duración: 30 segundos. Decisión de producto, no técnica.
 *
 * A 32 tokens por segundo son ~960 tokens por dictado (~$0,0014). Sobra para
 * cualquier comando del chat y, sobre todo, evita que un micrófono abierto por
 * olvido capte una conversación del despacho que nadie quería mandar a ningún sitio.
 */
export const MAX_DURACION_MS = 30_000;

/** Umbral para avisar en la UI de que quedan pocos segundos. */
export const AVISO_DURACION_MS = 25_000;

/** Por debajo de esto es un clic accidental, no un dictado. */
export const MIN_DURACION_MS = 500;

/** Un contenedor de audio con voz real nunca pesa tan poco; por debajo es silencio o un blob roto. */
export const MIN_AUDIO_BYTES = 1_200;

export type MotivoRechazo = 'muy_corto' | 'vacio' | 'muy_largo' | 'muy_grande';

export type ResultadoValidacion =
  | { ok: true }
  | { ok: false; motivo: MotivoRechazo; mensaje: string };

/** Mensajes de cara al usuario. Reutilizados por MENSAJE_FALLO en dictado-estado: qué ha pasado y qué hacer. Nunca el motivo crudo. */
export const MENSAJE_RECHAZO: Record<MotivoRechazo, string> = {
  muy_corto: 'El dictado ha sido demasiado corto. Mantén la grabación al menos un segundo.',
  vacio: 'No se ha grabado nada. Comprueba que el micrófono funciona e inténtalo otra vez.',
  muy_largo: 'El dictado supera los 30 segundos. Divídelo en frases más cortas.',
  muy_grande: 'La grabación es demasiado pesada para enviarla. Inténtalo de nuevo con un dictado más corto.',
};

export interface MedidasAudio {
  readonly bytes: number;
  readonly duracionMs: number;
}

/** Los topes son INCLUSIVOS: el borde exacto es válido. */
export function validarAudio({ bytes, duracionMs }: MedidasAudio): ResultadoValidacion {
  if (duracionMs < MIN_DURACION_MS) return rechazo('muy_corto');
  if (bytes < MIN_AUDIO_BYTES) return rechazo('vacio');
  if (duracionMs > MAX_DURACION_MS) return rechazo('muy_largo');
  if (bytes > MAX_AUDIO_BYTES) return rechazo('muy_grande');
  return { ok: true };
}

function rechazo(motivo: MotivoRechazo): ResultadoValidacion {
  return { ok: false, motivo, mensaje: MENSAJE_RECHAZO[motivo] };
}
