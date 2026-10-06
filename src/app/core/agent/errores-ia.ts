/**
 * Traducción de los fallos del modelo a lo que el usuario necesita saber.
 *
 * El SDK de Firebase AI lanza mensajes pensados para el desarrollador: URL
 * interna del proyecto, código HTTP y `(AI/fetch-error)`. En pantalla eso no
 * ayuda a nadie y además filtra el id del proyecto. El detalle crudo se queda
 * en la consola; al usuario le llega qué ha pasado y qué puede hacer.
 */

/** Códigos que significan "ahora no, prueba en un rato": cuota y sobrecarga. */
const STATUS_SATURACION = new Set([429, 503]);

/**
 * ¿El modelo ha rechazado la petición por saturación? Son los únicos fallos
 * que merece la pena reintentar: un 400 o un 403 fallará igual la segunda vez.
 */
export function esSaturacion(e: unknown): boolean {
  const status = (e as { customErrorData?: { status?: number } } | null)?.customErrorData?.status;
  if (status !== undefined) return STATUS_SATURACION.has(status);

  const mensaje = e instanceof Error ? e.message : '';
  return /\[(429|503)\s*\]|resource exhausted|overloaded/i.test(mensaje);
}

export function mensajeDeError(e: unknown): string {
  return esSaturacion(e)
    ? 'El asistente está saturado ahora mismo. Espera unos segundos y vuelve a intentarlo.'
    : 'No he podido contactar con el asistente. Vuelve a intentarlo en un momento.';
}
