import { describe, it, expect } from 'vitest';
import {
  MAX_AUDIO_BYTES,
  MAX_DURACION_MS,
  MIN_AUDIO_BYTES,
  MIN_DURACION_MS,
  validarAudio,
} from './audio-validacion';

const valido = { bytes: 60_000, duracionMs: 5_000 };

describe('validarAudio', () => {
  it('acepta un dictado normal de 5 segundos', () => {
    expect(validarAudio(valido)).toEqual({ ok: true });
  });

  it('rechaza como muy_corto un audio por debajo del mínimo de duración', () => {
    const r = validarAudio({ ...valido, duracionMs: MIN_DURACION_MS - 1 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toBe('muy_corto');
  });

  it('rechaza como vacio un blob sin datos aunque la duración parezca válida', () => {
    const r = validarAudio({ bytes: MIN_AUDIO_BYTES - 1, duracionMs: 5_000 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toBe('vacio');
  });

  it('rechaza como muy_largo un audio que supera el tope de 30 segundos', () => {
    const r = validarAudio({ ...valido, duracionMs: MAX_DURACION_MS + 1 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toBe('muy_largo');
  });

  it('rechaza como muy_grande un blob que supera el límite de bytes', () => {
    const r = validarAudio({ bytes: MAX_AUDIO_BYTES + 1, duracionMs: 5_000 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toBe('muy_grande');
  });

  it('trata los topes como inclusivos: el borde exacto pasa', () => {
    expect(validarAudio({ bytes: MAX_AUDIO_BYTES, duracionMs: MAX_DURACION_MS })).toEqual({ ok: true });
    expect(validarAudio({ bytes: MIN_AUDIO_BYTES, duracionMs: MIN_DURACION_MS })).toEqual({ ok: true });
  });

  it('el tope de duración es 30 segundos, la decisión de producto', () => {
    expect(MAX_DURACION_MS).toBe(30_000);
  });

  it('todo rechazo trae un mensaje en español, no el motivo crudo', () => {
    const casos = [
      { bytes: 60_000, duracionMs: 1 },
      { bytes: 10, duracionMs: 5_000 },
      { bytes: 60_000, duracionMs: MAX_DURACION_MS + 1 },
      { bytes: MAX_AUDIO_BYTES + 1, duracionMs: 5_000 },
    ];
    for (const caso of casos) {
      const r = validarAudio(caso);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.mensaje.length).toBeGreaterThan(10);
      expect(r.mensaje).not.toBe(r.motivo);
      expect(r.mensaje).not.toMatch(/_/);
    }
  });
});
