import { describe, it, expect } from 'vitest';
import { SIN_VOZ, fusionarDictado, limpiarTranscripcion } from './transcripcion-texto';

describe('limpiarTranscripcion', () => {
  it('deja intacto un texto que ya viene limpio', () => {
    expect(limpiarTranscripcion('Busca el caso de Juan Pérez')).toBe('Busca el caso de Juan Pérez');
  });

  it('quita las vallas de markdown que a veces añade el modelo', () => {
    expect(limpiarTranscripcion('```\nBusca el caso\n```')).toBe('Busca el caso');
  });

  it('quita el prefijo "Transcripción:"', () => {
    expect(limpiarTranscripcion('Transcripción: Busca el caso')).toBe('Busca el caso');
  });

  it('quita las comillas envolventes', () => {
    expect(limpiarTranscripcion('"Busca el caso"')).toBe('Busca el caso');
    expect(limpiarTranscripcion('«Busca el caso»')).toBe('Busca el caso');
  });

  it('colapsa saltos de línea y espacios múltiples', () => {
    expect(limpiarTranscripcion('Busca   el\n\ncaso')).toBe('Busca el caso');
  });

  it('devuelve cadena vacía ante el marcador de silencio', () => {
    expect(limpiarTranscripcion(SIN_VOZ)).toBe('');
  });

  it('devuelve cadena vacía cuando el modelo se disculpa en vez de transcribir', () => {
    expect(limpiarTranscripcion('Lo siento, no se escucha nada en el audio.')).toBe('');
    expect(limpiarTranscripcion('No se escucha ninguna voz.')).toBe('');
  });

  it('devuelve cadena vacía ante entrada vacía o solo espacios', () => {
    expect(limpiarTranscripcion('')).toBe('');
    expect(limpiarTranscripcion('   \n  ')).toBe('');
  });
});

describe('fusionarDictado', () => {
  it('en un campo vacío devuelve el dictado con el cursor al final', () => {
    expect(fusionarDictado('', 'Busca el caso', 0, 0)).toEqual({
      texto: 'Busca el caso',
      cursor: 13,
    });
  });

  it('añade un separador cuando el texto previo no acaba en espacio', () => {
    expect(fusionarDictado('Busca el caso', 'de Juan', 13, 13)).toEqual({
      texto: 'Busca el caso de Juan',
      cursor: 21,
    });
  });

  it('no duplica el espacio si el texto previo ya acaba en uno', () => {
    expect(fusionarDictado('Busca el caso ', 'de Juan', 14, 14)).toEqual({
      texto: 'Busca el caso de Juan',
      cursor: 21,
    });
  });

  it('reemplaza la selección: rellena un hueco tipo snippet', () => {
    const actual = 'Busca el contacto de NOMBRE';
    expect(fusionarDictado(actual, 'Juan Pérez', 21, 27)).toEqual({
      texto: 'Busca el contacto de Juan Pérez',
      cursor: 31,
    });
  });

  it('inserta en medio separando por ambos lados y deja el cursor tras lo dictado', () => {
    expect(fusionarDictado('Hola mundo', 'gran', 5, 5)).toEqual({
      texto: 'Hola gran mundo',
      cursor: 9,
    });
  });

  it('no añade separador cuando el dictado empieza por puntuación', () => {
    expect(fusionarDictado('Hola', ', Juan', 4, 4)).toEqual({
      texto: 'Hola, Juan',
      cursor: 10,
    });
  });

  it('devuelve el texto intacto si el dictado está vacío', () => {
    expect(fusionarDictado('Busca el caso', '', 13, 13)).toEqual({
      texto: 'Busca el caso',
      cursor: 13,
    });
  });
});
