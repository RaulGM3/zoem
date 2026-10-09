import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AiService } from '../services/ai.service';
import { IaCupoService } from '../planes/ia-cupo';
import { CupoIaAgotadoError } from '../agent/errores-ia';
import { ErrorDictado } from './error-dictado';
import { MAX_DURACION_MS } from './audio-validacion';
import { MENSAJE_FALLO } from './dictado-estado';
import { TranscripcionService } from './transcripcion.service';
import type { AudioCapturado } from './grabador.port';

function audio(over: Partial<AudioCapturado> = {}): AudioCapturado {
  return {
    blob: new Blob([new Uint8Array(40_000)], { type: 'audio/webm' }),
    mimeType: 'audio/webm;codecs=opus',
    duracionMs: 5_000,
    ...over,
  };
}

interface ParteInline {
  inlineData?: { data: string; mimeType: string };
}

function montar(responder: () => unknown, reservar = vi.fn().mockResolvedValue(undefined)) {
  const generateContent = vi.fn<(partes: ParteInline[]) => unknown>(() => responder());
  const getTextModel = vi.fn(() => ({ generateContent }));
  const getToolModel = vi.fn();
  const getJsonModel = vi.fn();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      TranscripcionService,
      { provide: AiService, useValue: { getTextModel, getToolModel, getJsonModel } },
      { provide: IaCupoService, useValue: { reservar } },
    ],
  });
  return {
    reservar,
    svc: TestBed.inject(TranscripcionService),
    generateContent,
    getTextModel,
    getToolModel,
    getJsonModel,
  };
}

const respuesta = (texto: string) => () => ({ response: { text: () => texto } });

describe('TranscripcionService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('devuelve la transcripción limpia del modelo', async () => {
    const { svc } = montar(respuesta('  Busca el caso de Juan Pérez  '));
    await expect(svc.transcribir(audio())).resolves.toBe('Busca el caso de Juan Pérez');
  });

  it('manda el MIME normalizado, no el crudo del MediaRecorder', async () => {
    const { svc, generateContent } = montar(respuesta('Hola'));
    await svc.transcribir(audio({ mimeType: 'audio/webm;codecs=opus' }));

    const inline = generateContent.mock.calls[0]![0].find((p) => p.inlineData)!.inlineData!;
    expect(inline.mimeType).toBe('audio/webm');
    expect(inline.data).toBeTruthy();
  });

  it('mapea el audio/mp4 de Safari antes de enviarlo', async () => {
    const { svc, generateContent } = montar(respuesta('Hola'));
    await svc.transcribir(audio({ mimeType: 'audio/mp4' }));

    const inline = generateContent.mock.calls[0]![0].find((p) => p.inlineData)!.inlineData!;
    expect(inline.mimeType).toBe('audio/m4a');
  });

  it('reserva UN mensaje de cupo de IA antes de llamar al modelo', async () => {
    const orden: string[] = [];
    const reservar = vi.fn(async () => { orden.push('reservar'); });
    const { svc, generateContent } = montar(() => { orden.push('modelo'); return respuesta('Hola')(); }, reservar);
    await svc.transcribir(audio());
    expect(orden).toEqual(['reservar', 'modelo']);
    expect(reservar).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('sin cupo: no llama al modelo y falla como cupo_ia', async () => {
    const { svc, generateContent } = montar(respuesta('Hola'), vi.fn().mockRejectedValue(new CupoIaAgotadoError()));
    await expect(svc.transcribir(audio())).rejects.toMatchObject({ motivo: 'cupo_ia' });
    expect(MENSAJE_FALLO.cupo_ia).toMatch(/cupo mensual de ia/i);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('un audio inválido NO gasta cupo', async () => {
    const { svc, reservar } = montar(respuesta('Hola'));
    await expect(svc.transcribir(audio({ mimeType: 'audio/amr' }))).rejects.toBeInstanceOf(ErrorDictado);
    expect(reservar).not.toHaveBeenCalled();
  });

  it('hace exactamente UNA llamada al modelo por dictado', async () => {
    const { svc, generateContent } = montar(respuesta('Hola'));
    await svc.transcribir(audio());
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('usa el modelo de texto plano, nunca el de tools ni el de JSON', async () => {
    const { svc, getTextModel, getToolModel, getJsonModel } = montar(respuesta('Hola'));
    await svc.transcribir(audio());
    expect(getTextModel).toHaveBeenCalledTimes(1);
    expect(getToolModel).not.toHaveBeenCalled();
    expect(getJsonModel).not.toHaveBeenCalled();
  });

  it('lanza sin_voz cuando el modelo responde el marcador de silencio', async () => {
    const { svc } = montar(respuesta('[SIN_VOZ]'));
    await expect(svc.transcribir(audio())).rejects.toMatchObject({ motivo: 'sin_voz' });
  });

  it('rechaza un audio demasiado largo SIN gastar un token', async () => {
    const { svc, generateContent } = montar(respuesta('Hola'));
    const largo = audio({ duracionMs: MAX_DURACION_MS + 1 });
    await expect(svc.transcribir(largo)).rejects.toBeInstanceOf(ErrorDictado);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('rechaza un formato no soportado SIN gastar un token', async () => {
    const { svc, generateContent } = montar(respuesta('Hola'));
    await expect(svc.transcribir(audio({ mimeType: 'audio/amr' })))
      .rejects.toMatchObject({ motivo: 'no_soportado' });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('traduce un fallo de la llamada a un ErrorDictado de red', async () => {
    const { svc } = montar(() => { throw new Error('network down'); });
    await expect(svc.transcribir(audio())).rejects.toMatchObject({ motivo: 'red' });
  });

  it('conserva y registra la causa real del fallo en vez de tragársela', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const causa = new Error('[400] Unsupported MIME type');
    const { svc } = montar(() => { throw causa; });

    await expect(svc.transcribir(audio())).rejects.toMatchObject({ motivo: 'red', cause: causa });
    expect(consola).toHaveBeenCalledWith(expect.stringContaining('dictado'), causa);

    consola.mockRestore();
  });
});

describe('TranscripcionService — cuota del modelo agotada (429)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const saturado = () =>
    Object.assign(new Error('AI: Error fetching from https://x: [429 ] Resource exhausted. (AI/fetch-error)'), {
      customErrorData: { status: 429 },
    });

  async function transcribirConReloj(svc: TranscripcionService) {
    const p = svc.transcribir(audio());
    p.catch(() => undefined);
    await vi.runAllTimersAsync();
    return p;
  }

  it('reintenta y transcribe si el modelo se recupera', async () => {
    let llamadas = 0;
    const { svc, generateContent } = montar(() => {
      if (llamadas++ === 0) throw saturado();
      return { response: { text: () => 'Hola' } };
    });

    await expect(transcribirConReloj(svc)).resolves.toBe('Hola');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('si sigue saturado, falla como "saturado" y NO culpa a la conexión', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { svc } = montar(() => { throw saturado(); });

    await expect(transcribirConReloj(svc)).rejects.toMatchObject({ motivo: 'saturado' });
    expect(MENSAJE_FALLO.saturado).not.toMatch(/conexión/i);
    expect(MENSAJE_FALLO.saturado).toMatch(/saturad/i);

    consola.mockRestore();
  });
});
