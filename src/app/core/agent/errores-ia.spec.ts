import { describe, it, expect } from 'vitest';
import { esSaturacion, mensajeDeError } from './errores-ia';

/** Forma real de un AIError del SDK de Firebase AI ante una cuota agotada. */
const errorSdk429 = Object.assign(
  new Error(
    'AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/projects/x/locations/eu/publishers/google/models/gemini:generateContent: [429 ] Resource exhausted. Please try again later. (AI/fetch-error)',
  ),
  { customErrorData: { status: 429, statusText: '' } },
);

describe('esSaturacion', () => {
  it('reconoce el 429 del SDK por su status', () => {
    expect(esSaturacion({ customErrorData: { status: 429 } })).toBe(true);
  });

  it('reconoce el 503 (modelo sobrecargado) por su status', () => {
    expect(esSaturacion({ customErrorData: { status: 503 } })).toBe(true);
  });

  it('reconoce la saturación aunque solo venga en el mensaje', () => {
    expect(esSaturacion(new Error('[429 ] Resource exhausted'))).toBe(true);
    expect(esSaturacion(new Error('The model is overloaded'))).toBe(true);
  });

  it('NO trata como saturación un error de permisos o de petición', () => {
    expect(esSaturacion({ customErrorData: { status: 403 } })).toBe(false);
    expect(esSaturacion(new Error('[400 ] Invalid argument'))).toBe(false);
    expect(esSaturacion('boom')).toBe(false);
  });
});

describe('mensajeDeError', () => {
  it('traduce la saturación a algo que el usuario entiende y puede accionar', () => {
    const texto = mensajeDeError(errorSdk429);
    expect(texto).toMatch(/saturado/i);
    expect(texto).toMatch(/vuelve a intentarlo/i);
  });

  it('NUNCA enseña la URL interna ni el código crudo del SDK', () => {
    for (const e of [errorSdk429, new Error('AI: Error fetching from https://x [500 ] (AI/fetch-error)')]) {
      const texto = mensajeDeError(e);
      expect(texto).not.toMatch(/https?:\/\//);
      expect(texto).not.toMatch(/AI\/fetch-error/);
    }
  });

  it('da un mensaje genérico para el resto de fallos', () => {
    expect(mensajeDeError(new Error('lo que sea'))).toMatch(/no he podido contactar/i);
  });
});
