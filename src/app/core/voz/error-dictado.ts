import { MENSAJE_FALLO, type MotivoFallo } from './dictado-estado';

/**
 * Error del dictado con motivo estructurado.
 *
 * El repo lanza `Error` con mensajes en español (ver doc-extraction.service).
 * Esto lo mantiene y añade el `motivo`, que es lo que la UI necesita para
 * decidir qué decir sin tener que interpretar la cadena del mensaje.
 *
 * `cause` guarda el error original cuando lo hay: el usuario ve el mensaje
 * amable, pero quien depura necesita saber qué respondió de verdad el modelo.
 */
export class ErrorDictado extends Error {
  constructor(readonly motivo: MotivoFallo, cause?: unknown) {
    super(MENSAJE_FALLO[motivo], cause === undefined ? undefined : { cause });
    this.name = 'ErrorDictado';
  }
}
