import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAX_DURACION_MS } from './audio-validacion';
import { DictadoService } from './dictado.service';
import { ErrorDictado } from './error-dictado';
import { GRABADOR, type AudioCapturado, type Grabador } from './grabador.port';
import { TranscripcionService } from './transcripcion.service';

const capturado: AudioCapturado = {
  blob: new Blob([new Uint8Array(40_000)], { type: 'audio/webm' }),
  mimeType: 'audio/webm',
  duracionMs: 5_000,
};

/** Deja correr las microtareas pendientes sin depender de timers reales. */
const flush = () => Promise.resolve().then().then().then();

function montar(opts: { soportado?: boolean; iniciar?: () => Promise<unknown>; transcribir?: () => Promise<string> } = {}) {
  const detener = vi.fn(async () => capturado);
  const cancelar = vi.fn();
  const iniciar = vi.fn(opts.iniciar ?? (async () => ({ detener, cancelar })));
  const transcribir = vi.fn(opts.transcribir ?? (async () => 'Busca el caso de Juan'));

  const grabador = {
    soportado: () => opts.soportado ?? true,
    iniciar,
  } as unknown as Grabador;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      DictadoService,
      { provide: GRABADOR, useValue: grabador },
      { provide: TranscripcionService, useValue: { transcribir } },
    ],
  });

  return { svc: TestBed.inject(DictadoService), iniciar, detener, cancelar, transcribir };
}

describe('DictadoService', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => vi.useRealTimers());

  it('la primera pulsación pide el micrófono y pasa a grabando', async () => {
    const { svc, iniciar } = montar();
    void svc.alternar();
    await flush();

    expect(svc.estado()).toBe('grabando');
    expect(svc.grabando()).toBe(true);
    expect(iniciar).toHaveBeenCalledTimes(1);
  });

  it('la segunda pulsación transcribe y devuelve el texto por la promesa de la primera', async () => {
    const { svc, detener, transcribir } = montar();
    const ciclo = svc.alternar();
    await flush();

    await svc.alternar();

    await expect(ciclo).resolves.toBe('Busca el caso de Juan');
    expect(detener).toHaveBeenCalledTimes(1);
    expect(transcribir).toHaveBeenCalledTimes(1);
    expect(svc.estado()).toBe('inactivo');
  });

  it('si se deniega el permiso queda en error y NUNCA llama a transcribir', async () => {
    const denegado = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const { svc, transcribir } = montar({ iniciar: () => Promise.reject(denegado) });

    await expect(svc.alternar()).resolves.toBeNull();

    expect(svc.estado()).toBe('error');
    expect(svc.mensajeError()).toMatch(/permisos del navegador/i);
    expect(transcribir).not.toHaveBeenCalled();
  });

  it('un fallo de transcripción deja el estado en error con su mensaje', async () => {
    const { svc } = montar({ transcribir: () => Promise.reject(new ErrorDictado('sin_voz')) });
    const ciclo = svc.alternar();
    await flush();
    await svc.alternar();

    await expect(ciclo).resolves.toBeNull();
    expect(svc.estado()).toBe('error');
    expect(svc.mensajeError()).toMatch(/no se ha detectado voz/i);
  });

  it('cancelar durante la grabación descarta el audio y no transcribe', async () => {
    const { svc, cancelar, transcribir } = montar();
    const ciclo = svc.alternar();
    await flush();

    svc.cancelar();

    await expect(ciclo).resolves.toBeNull();
    expect(cancelar).toHaveBeenCalledTimes(1);
    expect(transcribir).not.toHaveBeenCalled();
    expect(svc.estado()).toBe('inactivo');
  });

  it('corta solo al llegar al tope de 30 segundos y transcribe lo grabado', async () => {
    vi.useFakeTimers();
    const { svc, detener, transcribir } = montar();
    const ciclo = svc.alternar();
    await vi.advanceTimersByTimeAsync(0);
    expect(svc.estado()).toBe('grabando');

    await vi.advanceTimersByTimeAsync(MAX_DURACION_MS);

    await expect(ciclo).resolves.toBe('Busca el caso de Juan');
    expect(detener).toHaveBeenCalledTimes(1);
    expect(transcribir).toHaveBeenCalledTimes(1);
  });

  it('pulsar mientras transcribe NO arranca una segunda grabación', async () => {
    let soltar: (t: string) => void = () => {};
    const lenta = () => new Promise<string>((res) => { soltar = res; });
    const { svc, iniciar } = montar({ transcribir: lenta });

    const ciclo = svc.alternar();
    await flush();
    void svc.alternar();
    await flush();
    expect(svc.estado()).toBe('transcribiendo');

    await expect(svc.alternar()).resolves.toBeNull();
    expect(iniciar).toHaveBeenCalledTimes(1);

    soltar('Hola');
    await expect(ciclo).resolves.toBe('Hola');
  });

  it('expone que el dictado no está soportado cuando el grabador lo dice', () => {
    const { svc } = montar({ soportado: false });
    expect(svc.soportado()).toBe(false);
  });

  it('empezar un dictado nuevo limpia el error anterior', async () => {
    const denegado = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const { svc } = montar({ iniciar: () => Promise.reject(denegado) });
    await svc.alternar();
    expect(svc.mensajeError()).not.toBeNull();

    void svc.alternar();
    expect(svc.mensajeError()).toBeNull();
  });
});
