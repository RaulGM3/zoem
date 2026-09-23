import { InjectionToken } from '@angular/core';
import { elegirMimeGrabacion } from './audio-mime';
import { ErrorDictado } from './error-dictado';

/**
 * Puerto de grabación de audio: la frontera con el navegador.
 *
 * Existe para que TODO lo de arriba (servicio de dictado, componente) sea
 * testeable. `MediaRecorder` y `getUserMedia` no existen en jsdom, así que en
 * los tests se inyecta un `Grabador` falso por este mismo token.
 *
 * La implementación real NO se testea en unitarios a propósito: no hay forma
 * honesta de hacerlo sin navegador. Se verifica a mano (ver el plan).
 */

export interface AudioCapturado {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly duracionMs: number;
}

export interface SesionGrabacion {
  /** Cierra la grabación y devuelve el audio. Libera el micrófono siempre. */
  detener(): Promise<AudioCapturado>;
  /** Aborta y descarta lo grabado. Libera el micrófono siempre. */
  cancelar(): void;
}

export interface Grabador {
  soportado(): boolean;
  /** Pide permiso y arranca. Lanza `DOMException` si el usuario deniega. */
  iniciar(): Promise<SesionGrabacion>;
}

export class MediaRecorderGrabador implements Grabador {
  soportado(): boolean {
    if (typeof MediaRecorder === 'undefined') return false;
    if (!globalThis.navigator?.mediaDevices?.getUserMedia) return false;
    return elegirMimeGrabacion((m) => MediaRecorder.isTypeSupported(m)) !== null;
  }

  async iniciar(): Promise<SesionGrabacion> {
    const mimeType = elegirMimeGrabacion((m) => MediaRecorder.isTypeSupported(m));
    if (!mimeType) throw new ErrorDictado('no_soportado');

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    // Si algo falla tras obtener el stream hay que soltarlo igualmente, o el
    // indicador de micrófono del navegador se queda encendido para siempre.
    try {
      return new SesionMediaRecorder(stream, mimeType);
    } catch (e) {
      liberar(stream);
      throw e;
    }
  }
}

class SesionMediaRecorder implements SesionGrabacion {
  private readonly recorder: MediaRecorder;
  private readonly trozos: Blob[] = [];
  private readonly inicio = performance.now();
  private cerrada = false;

  constructor(
    private readonly stream: MediaStream,
    private readonly mimeType: string,
  ) {
    this.recorder = new MediaRecorder(stream, { mimeType });
    this.recorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) this.trozos.push(e.data);
    });
    this.recorder.start();
  }

  detener(): Promise<AudioCapturado> {
    if (this.cerrada) return Promise.reject(new ErrorDictado('desconocido'));
    this.cerrada = true;

    return new Promise<AudioCapturado>((resolve, reject) => {
      this.recorder.addEventListener('stop', () => {
        try {
          resolve({
            blob: new Blob(this.trozos, { type: this.mimeType }),
            mimeType: this.mimeType,
            duracionMs: performance.now() - this.inicio,
          });
        } finally {
          liberar(this.stream);
        }
      }, { once: true });

      this.recorder.addEventListener('error', () => {
        liberar(this.stream);
        reject(new ErrorDictado('desconocido'));
      }, { once: true });

      this.recorder.stop();
    });
  }

  cancelar(): void {
    if (this.cerrada) return;
    this.cerrada = true;
    try {
      if (this.recorder.state !== 'inactive') this.recorder.stop();
    } finally {
      this.trozos.length = 0;
      liberar(this.stream);
    }
  }
}

/** Soltar las pistas es lo que apaga el indicador de micrófono del navegador. */
function liberar(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

export const GRABADOR = new InjectionToken<Grabador>('GRABADOR', {
  providedIn: 'root',
  factory: () => new MediaRecorderGrabador(),
});
