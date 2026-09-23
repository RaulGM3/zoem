import { computed, inject, Injectable, signal } from '@angular/core';
import { MAX_DURACION_MS } from './audio-validacion';
import {
  anuncioDictado,
  clasificarErrorGrabacion,
  estaOcupado,
  etiquetaBotonDictado,
  MENSAJE_FALLO,
  reducirDictado,
  type EstadoDictado,
  type EventoDictado,
  type MotivoFallo,
} from './dictado-estado';
import { ErrorDictado } from './error-dictado';
import { GRABADOR, type SesionGrabacion } from './grabador.port';
import { TranscripcionService } from './transcripcion.service';

/**
 * Orquesta un ciclo de dictado: permiso → grabación → transcripción.
 *
 * NO contiene lógica de estado: toda transición pasa por `reducirDictado`, que
 * es puro y vive testeado aparte. Aquí solo hay efectos (micrófono, Gemini,
 * temporizador) y la traducción de excepciones a motivos del dominio.
 *
 * `@Injectable()` SIN `providedIn: 'root'` a propósito: se provee en el
 * componente que lo usa, de modo que cada composer tenga su propia sesión y los
 * tests arranquen siempre con un servicio limpio.
 *
 * CONTRATO DE `alternar()`: la promesa de la PRIMERA pulsación es la que
 * entrega el texto, y se resuelve tanto si el usuario vuelve a pulsar como si
 * salta el corte automático. Las pulsaciones siguientes devuelven `null`, así
 * el consumidor nunca emite la misma transcripción dos veces.
 */
@Injectable()
export class DictadoService {
  private readonly grabador = inject(GRABADOR);
  private readonly transcripcion = inject(TranscripcionService);

  private readonly _estado = signal<EstadoDictado>('inactivo');
  private readonly _motivo = signal<MotivoFallo | null>(null);

  readonly estado = this._estado.asReadonly();
  readonly grabando = computed(() => this.estado() === 'grabando');
  readonly ocupado = computed(() => estaOcupado(this.estado()));
  readonly etiqueta = computed(() => etiquetaBotonDictado(this.estado()));
  readonly anuncio = computed(() => anuncioDictado(this.estado()));
  readonly mensajeError = computed(() => {
    const motivo = this._motivo();
    return motivo ? MENSAJE_FALLO[motivo] : null;
  });

  private sesion: SesionGrabacion | null = null;
  private corte: ReturnType<typeof setTimeout> | null = null;
  private resolver: ((texto: string | null) => void) | null = null;

  soportado(): boolean {
    return this.grabador.soportado();
  }

  alternar(): Promise<string | null> {
    const estado = this.estado();

    if (estado === 'grabando') {
      void this.finalizar();
      return Promise.resolve(null);
    }
    if (estado !== 'inactivo' && estado !== 'error') {
      // permiso o transcribiendo: hay algo en vuelo y ya se ha pagado.
      return Promise.resolve(null);
    }
    return this.iniciar();
  }

  /** Aborta y descarta. El audio no llega a salir del navegador. */
  cancelar(): void {
    if (!estaOcupado(this.estado()) && this.estado() !== 'error') return;
    this.limpiarCorte();
    this.sesion?.cancelar();
    this.sesion = null;
    this.despachar({ tipo: 'cancelar' });
    this.entregar(null);
  }

  private async iniciar(): Promise<string | null> {
    this._motivo.set(null);
    this.despachar({ tipo: 'pulsar' });

    const ciclo = new Promise<string | null>((resolve) => {
      this.resolver = resolve;
    });

    try {
      const sesion = await this.grabador.iniciar();

      // El usuario pudo cancelar mientras el navegador pedía el permiso.
      if (this.estado() !== 'permiso') {
        sesion.cancelar();
        this.entregar(null);
        return ciclo;
      }

      this.sesion = sesion;
      this.despachar({ tipo: 'permiso_ok' });
      this.corte = setTimeout(() => void this.finalizar(), MAX_DURACION_MS);
    } catch (e) {
      this.fallar(motivoDe(e));
      this.entregar(null);
    }

    return ciclo;
  }

  private async finalizar(): Promise<void> {
    const sesion = this.sesion;
    if (!sesion || this.estado() !== 'grabando') return;

    this.limpiarCorte();
    this.sesion = null;
    this.despachar({ tipo: 'detener' });

    try {
      const audio = await sesion.detener();
      const texto = await this.transcripcion.transcribir(audio);
      this.despachar({ tipo: 'transcrito' });
      this.entregar(texto);
    } catch (e) {
      this.fallar(motivoDe(e));
      this.entregar(null);
    }
  }

  private despachar(evento: EventoDictado): void {
    this._estado.set(reducirDictado(this._estado(), evento));
  }

  private fallar(motivo: MotivoFallo): void {
    this._motivo.set(motivo);
    this.despachar({ tipo: 'fallo', motivo });
  }

  /** Resuelve el ciclo una sola vez: las pulsaciones extra no duplican la entrega. */
  private entregar(texto: string | null): void {
    const resolver = this.resolver;
    this.resolver = null;
    resolver?.(texto);
  }

  private limpiarCorte(): void {
    if (this.corte === null) return;
    clearTimeout(this.corte);
    this.corte = null;
  }
}

/** Un `ErrorDictado` ya trae el motivo; de un `DOMException` hay que deducirlo. */
function motivoDe(e: unknown): MotivoFallo {
  if (e instanceof ErrorDictado) return e.motivo;
  return clasificarErrorGrabacion(e instanceof Error ? e.name : '');
}
