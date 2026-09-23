import { describe, it, expect } from 'vitest';
import {
  ESTADOS_DICTADO,
  MENSAJE_FALLO,
  MOTIVOS_FALLO,
  anuncioDictado,
  clasificarErrorGrabacion,
  estaOcupado,
  etiquetaBotonDictado,
  reducirDictado,
  type EstadoDictado,
} from './dictado-estado';

describe('reducirDictado — ciclo feliz', () => {
  it('recorre inactivo → permiso → grabando → transcribiendo → inactivo', () => {
    let e: EstadoDictado = 'inactivo';
    e = reducirDictado(e, { tipo: 'pulsar' });
    expect(e).toBe('permiso');
    e = reducirDictado(e, { tipo: 'permiso_ok' });
    expect(e).toBe('grabando');
    e = reducirDictado(e, { tipo: 'detener' });
    expect(e).toBe('transcribiendo');
    e = reducirDictado(e, { tipo: 'transcrito' });
    expect(e).toBe('inactivo');
  });

  it('pulsar mientras graba equivale a detener', () => {
    expect(reducirDictado('grabando', { tipo: 'pulsar' })).toBe('transcribiendo');
  });
});

describe('reducirDictado — fallos y cancelación', () => {
  it('un fallo lleva a error desde cualquier estado', () => {
    for (const estado of ESTADOS_DICTADO) {
      expect(reducirDictado(estado, { tipo: 'fallo', motivo: 'red' })).toBe('error');
    }
  });

  it('cancelar desde grabando vuelve a inactivo', () => {
    expect(reducirDictado('grabando', { tipo: 'cancelar' })).toBe('inactivo');
  });

  it('cancelar desde permiso y desde error vuelve a inactivo', () => {
    expect(reducirDictado('permiso', { tipo: 'cancelar' })).toBe('inactivo');
    expect(reducirDictado('error', { tipo: 'cancelar' })).toBe('inactivo');
  });

  it('desde error se puede reintentar pulsando', () => {
    expect(reducirDictado('error', { tipo: 'pulsar' })).toBe('permiso');
  });
});

describe('reducirDictado — es total: los eventos imposibles no rompen', () => {
  it('detener en inactivo no cambia nada', () => {
    expect(reducirDictado('inactivo', { tipo: 'detener' })).toBe('inactivo');
  });

  it('pulsar durante la transcripción NO arranca otra grabación', () => {
    expect(reducirDictado('transcribiendo', { tipo: 'pulsar' })).toBe('transcribiendo');
  });

  it('cancelar durante la transcripción no interrumpe la llamada en vuelo', () => {
    expect(reducirDictado('transcribiendo', { tipo: 'cancelar' })).toBe('transcribiendo');
  });

  it('ningún par estado/evento produce un estado fuera del conjunto', () => {
    for (const estado of ESTADOS_DICTADO) {
      for (const tipo of ['pulsar', 'permiso_ok', 'detener', 'transcrito', 'cancelar'] as const) {
        expect(ESTADOS_DICTADO).toContain(reducirDictado(estado, { tipo }));
      }
    }
  });
});

describe('textos de interfaz', () => {
  it('cada estado tiene una etiqueta propia y no vacía', () => {
    const etiquetas = ESTADOS_DICTADO.map(etiquetaBotonDictado);
    expect(etiquetas.every((e) => e.length > 0)).toBe(true);
    expect(new Set(etiquetas).size).toBe(ESTADOS_DICTADO.length);
  });

  it('solo el estado inactivo calla a la live region', () => {
    expect(anuncioDictado('inactivo')).toBe('');
    for (const estado of ESTADOS_DICTADO.filter((e) => e !== 'inactivo')) {
      expect(anuncioDictado(estado).length).toBeGreaterThan(0);
    }
  });

  it('hay mensaje para todos los motivos de fallo', () => {
    for (const motivo of MOTIVOS_FALLO) {
      expect(MENSAJE_FALLO[motivo]?.length ?? 0).toBeGreaterThan(10);
    }
  });
});

describe('estaOcupado', () => {
  it('es cierto exactamente en permiso, grabando y transcribiendo', () => {
    expect(ESTADOS_DICTADO.filter(estaOcupado)).toEqual(['permiso', 'grabando', 'transcribiendo']);
  });
});

describe('clasificarErrorGrabacion', () => {
  it('mapea los DOMException conocidos de getUserMedia', () => {
    expect(clasificarErrorGrabacion('NotAllowedError')).toBe('permiso_denegado');
    expect(clasificarErrorGrabacion('SecurityError')).toBe('permiso_denegado');
    expect(clasificarErrorGrabacion('NotFoundError')).toBe('sin_microfono');
    expect(clasificarErrorGrabacion('DevicesNotFoundError')).toBe('sin_microfono');
    expect(clasificarErrorGrabacion('NotReadableError')).toBe('micro_ocupado');
    expect(clasificarErrorGrabacion('AbortError')).toBe('micro_ocupado');
  });

  it('cae a desconocido ante un nombre que no conoce', () => {
    expect(clasificarErrorGrabacion('LoQueSea')).toBe('desconocido');
    expect(clasificarErrorGrabacion('')).toBe('desconocido');
  });
});
