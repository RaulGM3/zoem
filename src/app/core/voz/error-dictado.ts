import { MENSAJE_FALLO, type MotivoFallo } from './dictado-estado';

/**
 * Error del dictado con motivo estructurado.
 *
 * El repo lanza `Error` con mensajes en español (ver doc-extraction.service).
 * Esto lo mantiene y añade el `motivo`, que es lo que la UI necesita para
 * decidir qué decir sin tener que interpretar la cadena del mensaje.
 */
export class ErrorDictado extends Error {
  constructor(readonly motivo: MotivoFallo) {
    super(MENSAJE_FALLO[motivo]);
    this.name = 'ErrorDictado';
  }
}
