/**
 * Saneado de la transcripción y su fusión con lo ya escrito (puro, sin framework).
 *
 * Dos responsabilidades, las dos con trampa:
 *
 * 1. El modelo obedece el prompt casi siempre, pero "casi" no basta: a veces
 *    envuelve la respuesta en vallas de markdown, la precede de "Transcripción:"
 *    o se disculpa en prosa cuando no oye nada. Nada de eso debe llegar al input.
 *
 * 2. El dictado NO reemplaza lo que el usuario ya había escrito: se inserta en
 *    la posición del cursor respetando la selección, como haría un teclado.
 */

/** Marcador que el prompt pide devolver cuando no hay voz inteligible. */
export const SIN_VOZ = '[SIN_VOZ]';

/** Vallas de markdown, con o sin lenguaje declarado. */
const VALLAS = /^```[a-z]*\s*|\s*```$/gi;

/** Prefijos de cortesía que el modelo cuela de vez en cuando. */
const PREFIJO = /^(transcripci[oó]n|texto|audio)\s*:\s*/i;

/** Comillas envolventes en cualquiera de sus formas. */
const COMILLAS = /^["'«“”]+|["'»“”]+$/g;

/**
 * El modelo se disculpa en vez de devolver `[SIN_VOZ]`. Se trata como silencio.
 *
 * Asume el riesgo de descartar un dictado real que empiece por estas palabras
 * ("no se escucha bien el audio del juicio"). Es un intercambio aceptable:
 * descartar de más solo cuesta repetir el dictado; colar la disculpa del modelo
 * en el input como si fuera lo que dijo el usuario es peor.
 */
const DISCULPA = /^(lo siento|lo lamento|no se (escucha|oye|detecta)|no he (podido|detectado|o[ií]do)|no hay (voz|audio))/i;

/** Devuelve la transcripción lista para el input, o `''` si no hubo voz. */
export function limpiarTranscripcion(raw: string): string {
  const texto = raw
    .trim()
    .replace(VALLAS, '')
    .trim()
    .replace(PREFIJO, '')
    .replace(COMILLAS, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!texto) return '';
  if (texto.includes(SIN_VOZ)) return '';
  if (DISCULPA.test(texto)) return '';
  return texto;
}

/** Caracteres tras los que NO se abre separador. */
const ABRE = /[\s(¿¡«"'[]/;
/** Un dictado que empieza así se pega al texto previo sin espacio. */
const PUNTUACION_INICIAL = /^[.,;:!?)\]»]/;

export interface FusionDictado {
  readonly texto: string;
  readonly cursor: number;
}

/**
 * Inserta `dictado` sustituyendo el rango `[inicio, fin)` de `actual`.
 *
 * Añade separadores solo donde hacen falta, de modo que dictar sobre un hueco
 * seleccionado (las sugerencias tipo snippet del composer) o al final de una
 * frase a medias produzca texto natural sin espacios dobles.
 */
export function fusionarDictado(
  actual: string,
  dictado: string,
  inicio: number,
  fin: number,
): FusionDictado {
  if (!dictado.trim()) return { texto: actual, cursor: fin };

  const antes = actual.slice(0, inicio);
  const despues = actual.slice(fin);

  const separaAntes = antes.length > 0
    && !ABRE.test(antes.at(-1)!)
    && !PUNTUACION_INICIAL.test(dictado);
  const separaDespues = despues.length > 0 && !/^[\s.,;:!?)]/.test(despues);

  const nucleo = (separaAntes ? ' ' : '') + dictado;
  return {
    texto: antes + nucleo + (separaDespues ? ' ' : '') + despues,
    cursor: antes.length + nucleo.length,
  };
}
