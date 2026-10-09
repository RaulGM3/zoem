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
/**
 * El cupo MENSUAL de IA del plan se ha agotado (lo decide el servidor en `reservarIA`).
 * No es saturación del modelo: reintentar no sirve, hay que esperar al mes siguiente o mejorar el plan.
 */
export class CupoIaAgotadoError extends Error {
  constructor() {
    super('Cupo mensual de IA agotado');
    this.name = 'CupoIaAgotadoError';
  }
}

export function esSaturacion(e: unknown): boolean {
  const status = (e as { customErrorData?: { status?: number } } | null)?.customErrorData?.status;
  if (status !== undefined) return STATUS_SATURACION.has(status);

  const mensaje = e instanceof Error ? e.message : '';
  return /\[(429|503)\s*\]|resource exhausted|overloaded/i.test(mensaje);
}

export function mensajeDeError(e: unknown): string {
  if (e instanceof CupoIaAgotadoError) {
    return 'Has agotado el cupo mensual de IA de tu plan. Se renueva el mes que viene, o puedes mejorar el plan.';
  }
  return esSaturacion(e)
    ? 'El asistente está saturado ahora mismo. Espera unos segundos y vuelve a intentarlo.'
    : 'No he podido contactar con el asistente. Vuelve a intentarlo en un momento.';
}

/**
 * Pausas antes de cada reintento cuando el modelo responde 429/503. Dos
 * intentos más, con espera creciente: suficiente para pasar un pico de cuota
 * sin dejar al usuario esperando más de unos segundos extra.
 */
export const ESPERAS_REINTENTO_MS = [1500, 4000] as const;

/**
 * Ejecuta `fn` y la repite SOLO si falla por saturación. Cualquier otro error
 * sale a la primera: reintentar un 400 es gastar tiempo para fallar igual.
 *
 * `fn` debe ser repetible sin efectos: una llamada al modelo con los mismos
 * contenidos, nunca algo que ejecute tools.
 */
export async function conReintento<T>(fn: () => Promise<T>): Promise<T> {
  for (let intento = 0; ; intento++) {
    try {
      return await fn();
    } catch (e) {
      const espera = ESPERAS_REINTENTO_MS[intento];
      if (espera === undefined || !esSaturacion(e)) throw e;
      await new Promise((r) => setTimeout(r, espera));
    }
  }
}
