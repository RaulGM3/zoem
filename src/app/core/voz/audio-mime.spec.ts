import { describe, it, expect } from 'vitest';
import {
  CANDIDATOS_GRABACION,
  MIMES_AUDIO_GEMINI,
  elegirMimeGrabacion,
  normalizarMimeAudio,
} from './audio-mime';

describe('normalizarMimeAudio', () => {
  it('corta el parámetro de codec que añade Chrome', () => {
    expect(normalizarMimeAudio('audio/webm;codecs=opus')).toBe('audio/webm');
  });

  it('tolera mayúsculas y espacios sobrantes', () => {
    expect(normalizarMimeAudio('  AUDIO/WEBM  ')).toBe('audio/webm');
  });

  it('mapea el audio/mp4 de Safari a audio/m4a, que sí acepta Gemini', () => {
    expect(normalizarMimeAudio('audio/mp4')).toBe('audio/m4a');
  });

  it('mapea audio/mp4 con codec a audio/m4a', () => {
    expect(normalizarMimeAudio('audio/mp4;codecs=mp4a.40.2')).toBe('audio/m4a');
  });

  it('mapea los alias históricos de wav', () => {
    expect(normalizarMimeAudio('audio/x-wav')).toBe('audio/wav');
    expect(normalizarMimeAudio('audio/wave')).toBe('audio/wav');
    expect(normalizarMimeAudio('audio/vnd.wave')).toBe('audio/wav');
  });

  it('mapea audio/x-m4a a audio/m4a', () => {
    expect(normalizarMimeAudio('audio/x-m4a')).toBe('audio/m4a');
  });

  it('devuelve null para un formato que Gemini no acepta', () => {
    expect(normalizarMimeAudio('audio/amr')).toBeNull();
  });

  it('devuelve null para cadena vacía o basura', () => {
    expect(normalizarMimeAudio('')).toBeNull();
    expect(normalizarMimeAudio('   ')).toBeNull();
  });

  it('no confunde un contenedor de vídeo con uno de audio', () => {
    expect(normalizarMimeAudio('video/webm')).toBeNull();
  });
});

describe('elegirMimeGrabacion', () => {
  it('prefiere webm con opus cuando el navegador lo soporta todo', () => {
    expect(elegirMimeGrabacion(() => true)).toBe('audio/webm;codecs=opus');
  });

  it('cae a audio/mp4 cuando solo Safari lo soporta', () => {
    const soportado = (m: string) => m === 'audio/mp4';
    expect(elegirMimeGrabacion(soportado)).toBe('audio/mp4');
  });

  it('devuelve null cuando el navegador no soporta ningún candidato', () => {
    expect(elegirMimeGrabacion(() => false)).toBeNull();
  });
});

describe('invariante candidatos ↔ Gemini', () => {
  it('todo candidato de grabación se normaliza a un MIME que Gemini acepta', () => {
    for (const candidato of CANDIDATOS_GRABACION) {
      const normalizado = normalizarMimeAudio(candidato);
      expect(normalizado, `candidato sin equivalente en Gemini: ${candidato}`).not.toBeNull();
      expect(MIMES_AUDIO_GEMINI).toContain(normalizado!);
    }
  });
});
