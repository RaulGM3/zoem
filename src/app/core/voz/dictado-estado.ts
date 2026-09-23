/**
 * Máquina de estados del dictado, como reductor puro (sin framework).
 *
 * El servicio de Angular NO decide transiciones: solo produce efectos (pedir el
 * micrófono, llamar a Gemini) y despacha eventos aquí. Así toda la lógica de
 * estado se testea sin TestBed, sin timers y sin navegador.
 *
 * Los textos de interfaz también viven aquí a propósito: la plantilla no debe
 * contener cadenas condicionales que nadie pueda testear.
 */

import { MENSAJE_RECHAZO, type MotivoRechazo } from './audio-validacion';

export const ESTADOS_DICTADO = [
  'inactivo',
  'permiso',
  'grabando',
  'transcribiendo',
  'error',
] as const;

export type EstadoDictado = (typeof ESTADOS_DICTADO)[number];

/** Motivos propios de la captura, más los de validación del audio. */
export const MOTIVOS_FALLO = [
  'permiso_denegado',
  'sin_microfono',
  'micro_ocupado',
  'no_soportado',
  'sin_voz',
  'red',
  'desconocido',
  'muy_corto',
  'vacio',
  'muy_largo',
  'muy_grande',
] as const;

export type MotivoFallo = (typeof MOTIVOS_FALLO)[number];

export type EventoDictado =
  | { tipo: 'pulsar' | 'permiso_ok' | 'detener' | 'transcrito' | 'cancelar' }
  | { tipo: 'fallo'; motivo: MotivoFallo };

/**
 * Reductor TOTAL: cualquier par estado/evento devuelve un estado válido.
 *
 * Que sea total no es un detalle de estilo. Los eventos llegan de promesas que
 * se resuelven tarde (un `getUserMedia` que responde cuando el usuario ya
 * canceló), así que los pares "imposibles" ocurren de verdad. Aquí se ignoran
 * en silencio en vez de lanzar.
 */
export function reducirDictado(estado: EstadoDictado, evento: EventoDictado): EstadoDictado {
  if (evento.tipo === 'fallo') return 'error';

  switch (estado) {
    case 'inactivo':
      return evento.tipo === 'pulsar' ? 'permiso' : 'inactivo';

    case 'permiso':
      if (evento.tipo === 'permiso_ok') return 'grabando';
      if (evento.tipo === 'cancelar') return 'inactivo';
      return 'permiso';

    case 'grabando':
      // Pulsar el botón mientras graba ES detener: el toggle tiene un solo gesto.
      if (evento.tipo === 'detener' || evento.tipo === 'pulsar') return 'transcribiendo';
      if (evento.tipo === 'cancelar') return 'inactivo';
      return 'grabando';

    case 'transcribiendo':
      // Ni `pulsar` ni `cancelar` hacen nada: la llamada ya está en vuelo y ya
      // se ha pagado. Dejar que `pulsar` arrancara otra grabación duplicaría el coste.
      return evento.tipo === 'transcrito' ? 'inactivo' : 'transcribiendo';

    case 'error':
      if (evento.tipo === 'pulsar') return 'permiso';
      if (evento.tipo === 'cancelar') return 'inactivo';
      return 'error';
  }
}

/** Mensajes de cara al usuario: qué ha pasado y qué puede hacer. */
export const MENSAJE_FALLO: Record<MotivoFallo, string> = {
  ...(MENSAJE_RECHAZO as Record<MotivoRechazo, string>),
  permiso_denegado:
    'No hay acceso al micrófono. Actívalo en los permisos del navegador para este sitio.',
  sin_microfono: 'No se ha detectado ningún micrófono conectado.',
  micro_ocupado: 'El micrófono está siendo usado por otra aplicación.',
  no_soportado: 'Este navegador no puede grabar audio en un formato compatible.',
  sin_voz: 'No se ha detectado voz. Acércate al micrófono e inténtalo otra vez.',
  red: 'No se ha podido transcribir el dictado. Comprueba la conexión e inténtalo de nuevo.',
  desconocido: 'No se ha podido completar el dictado. Inténtalo de nuevo.',
};

/** `aria-label` del botón. Cambia con el estado para que el lector anuncie la acción real. */
export function etiquetaBotonDictado(estado: EstadoDictado): string {
  switch (estado) {
    case 'inactivo': return 'Dictar mensaje por voz';
    case 'permiso': return 'Solicitando acceso al micrófono';
    case 'grabando': return 'Detener el dictado y transcribir';
    case 'transcribiendo': return 'Transcribiendo el dictado';
    case 'error': return 'Reintentar el dictado por voz';
  }
}

/** Texto de la live region. Vacío en reposo para no anunciar nada sin motivo. */
export function anuncioDictado(estado: EstadoDictado): string {
  switch (estado) {
    case 'inactivo': return '';
    case 'permiso': return 'Pidiendo permiso para usar el micrófono.';
    case 'grabando': return 'Grabando. Vuelve a pulsar para terminar.';
    case 'transcribiendo': return 'Transcribiendo el dictado.';
    case 'error': return 'El dictado no se ha podido completar.';
  }
}

/** Hay una operación en curso: el botón no debe aceptar un gesto nuevo. */
export function estaOcupado(estado: EstadoDictado): boolean {
  return estado === 'permiso' || estado === 'grabando' || estado === 'transcribiendo';
}

/**
 * Traduce el `name` de un `DOMException` de getUserMedia a un motivo del dominio.
 * Recibe el nombre como string, no el objeto: así es pura y trivial de testear.
 */
export function clasificarErrorGrabacion(nombre: string): MotivoFallo {
  switch (nombre) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'permiso_denegado';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'sin_microfono';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'micro_ocupado';
    case 'NotSupportedError':
      return 'no_soportado';
    default:
      return 'desconocido';
  }
}
