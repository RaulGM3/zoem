import { vi } from 'vitest';
import { computed, signal } from '@angular/core';
import {
  anuncioDictado,
  etiquetaBotonDictado,
  type EstadoDictado,
} from '../app/core/voz/dictado-estado';

/**
 * Dictado falso con el mismo contrato que `DictadoService`: la promesa de la
 * primera pulsación entrega el texto, y el test decide cuándo llega.
 */
export function fakeDictado(soportado = true) {
  const estado = signal<EstadoDictado>('inactivo');
  const mensajeError = signal<string | null>(null);
  let resolver: (texto: string | null) => void = () => {};

  return {
    estado,
    mensajeError,
    grabando: computed(() => estado() === 'grabando'),
    etiqueta: computed(() => etiquetaBotonDictado(estado())),
    anuncio: computed(() => anuncioDictado(estado())),
    soportado: () => soportado,
    alternar: vi.fn(() => {
      if (estado() === 'grabando') {
        estado.set('transcribiendo');
        return Promise.resolve(null);
      }
      estado.set('grabando');
      return new Promise<string | null>((r) => (resolver = r));
    }),
    cancelar: vi.fn(() => estado.set('inactivo')),
    /** Simula que Gemini devuelve la transcripción. */
    transcribir(texto: string) {
      estado.set('inactivo');
      resolver(texto);
    },
    fallar(mensaje: string) {
      estado.set('error');
      mensajeError.set(mensaje);
      resolver(null);
    },
  };
}
