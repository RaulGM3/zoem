/**
 * Negociación de formato de audio entre `MediaRecorder` y Gemini (puro, sin framework).
 *
 * El problema que resuelve: los dos extremos NO hablan el mismo dialecto de MIME.
 * `MediaRecorder` devuelve el tipo con parámetros (`audio/webm;codecs=opus` en
 * Chrome) y usa nombres de contenedor propios (`audio/mp4` en Safari), mientras
 * que Gemini solo admite una lista cerrada de tipos canónicos. Mandar el tipo
 * crudo hace que la petición falle con un error poco descriptivo.
 *
 * `MediaRecorder.isTypeSupported` entra como PARÁMETRO, no se lee del global:
 * por eso este módulo es puro y se puede testear sin navegador ni jsdom.
 */

/** Tipos de audio que Gemini acepta como `inlineData`. */
export const MIMES_AUDIO_GEMINI: readonly string[] = [
  'audio/wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/aiff',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'audio/m4a',
  'audio/l16',
  'audio/opus',
  'audio/alaw',
  'audio/mulaw',
  'audio/webm',
];

/**
 * Alias de contenedor → tipo canónico de Gemini.
 *
 * `audio/mp4` es el caso importante: es lo que graba Safari y NO está en la
 * lista de Gemini, pero es el mismo contenedor que `audio/m4a`. El mapeo evita
 * tener que reencodear el audio en el navegador.
 */
const ALIAS: Record<string, string> = {
  'audio/mp4': 'audio/m4a',
  'audio/x-m4a': 'audio/m4a',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/vorbis': 'audio/ogg',
};

/**
 * Formatos de grabación por orden de preferencia. Opus en WebM es el más
 * compacto y el mejor soportado; `audio/mp4` es la salida de Safari.
 *
 * INVARIANTE (verificada en el spec): todo candidato de esta lista tiene que
 * normalizar a un tipo de `MIMES_AUDIO_GEMINI`. Si añades uno que no, la
 * grabación funcionará y la transcripción fallará en producción.
 */
export const CANDIDATOS_GRABACION: readonly string[] = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
];

/**
 * Pasa el MIME de `MediaRecorder` al dialecto de Gemini.
 * Devuelve `null` si el formato no tiene equivalente aceptado.
 */
export function normalizarMimeAudio(mime: string): string | null {
  const base = mime.split(';')[0].trim().toLowerCase();
  if (!base) return null;

  const canonico = ALIAS[base] ?? base;
  return MIMES_AUDIO_GEMINI.includes(canonico) ? canonico : null;
}

/**
 * Primer formato de `CANDIDATOS_GRABACION` que el navegador sabe grabar.
 * `null` significa que este navegador no puede grabar audio para Gemini y que
 * el dictado debe ocultarse por completo.
 */
export function elegirMimeGrabacion(soportado: (mime: string) => boolean): string | null {
  return CANDIDATOS_GRABACION.find((mime) => soportado(mime)) ?? null;
}
