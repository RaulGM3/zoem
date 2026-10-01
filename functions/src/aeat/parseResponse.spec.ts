import { describe, it, expect } from 'vitest';
import { parseRespuesta } from './parseResponse';
import {
  CSV_EJEMPLO,
  respuestaAceptadoConErrores,
  respuestaCorrecto,
  respuestaCorrectoOtrosPrefijos,
  respuestaDuplicado,
  respuestaFault200,
  respuestaFault4104,
  respuestaHttp500Html,
  respuestaHttp503,
  respuestaIncorrecto,
  respuestaMalformada,
  respuestaSinEstadoRegistro,
  respuestaTextoBasura,
  respuestaVacia,
  respuestaXml,
} from './testing/respuestas';

describe('parseRespuesta - tipos base', () => {
  it('S6.1 Correcto con CSV -> correcto con csv y espera', () => {
    expect(parseRespuesta(respuestaCorrecto)).toEqual({ tipo: 'correcto', csv: CSV_EJEMPLO, esperaS: 60 });
  });

  it('empareja por nombre local: otros prefijos y namespace por defecto', () => {
    expect(parseRespuesta(respuestaCorrectoOtrosPrefijos)).toEqual({ tipo: 'correcto', csv: CSV_EJEMPLO, esperaS: 60 });
  });

  it('S6.2 AceptadoConErrores -> código y descripción', () => {
    expect(parseRespuesta(respuestaAceptadoConErrores)).toEqual({
      tipo: 'aceptadoConErrores',
      csv: CSV_EJEMPLO,
      codigo: '2001',
      descripcion: 'Aviso: error admisible en el registro',
      esperaS: 60,
    });
  });

  it('S6.3 Incorrecto con 1xxx -> incorrecto con código y descripción, sin duplicado', () => {
    const r = parseRespuesta(respuestaIncorrecto);
    expect(r).toEqual({ tipo: 'incorrecto', codigo: '1100', descripcion: 'Valor del campo incorrecto', esperaS: 60 });
    expect('duplicado' in r).toBe(false);
  });

  it('S6.4 HTTP 500 con HTML -> transporte, nunca correcto', () => {
    expect(parseRespuesta(respuestaHttp500Html)).toEqual({ tipo: 'transporte', status: 500 });
    expect(parseRespuesta(respuestaHttp503)).toEqual({ tipo: 'transporte', status: 503 });
  });

  it('R6.2 un status no-2xx con cuerpo "Correcto" tampoco es correcto', () => {
    const r = parseRespuesta({ status: 502, body: respuestaCorrecto.body });
    expect(r).toEqual({ tipo: 'transporte', status: 502 });
  });

  it('S6.5 SOAP Fault (4104, status 500) -> fault con faultstring', () => {
    const r = parseRespuesta(respuestaFault4104);
    expect(r.tipo).toBe('fault');
    if (r.tipo === 'fault') expect(r.faultstring).toContain('4104');
  });

  it('un Fault con status 200 sigue siendo fault', () => {
    expect(parseRespuesta(respuestaFault200).tipo).toBe('fault');
  });

  it('S6.6 vacío, basura, malformado y 200 sin EstadoRegistro -> unknown', () => {
    expect(parseRespuesta(respuestaVacia)).toEqual({ tipo: 'unknown' });
    expect(parseRespuesta(respuestaTextoBasura)).toEqual({ tipo: 'unknown' });
    expect(parseRespuesta(respuestaMalformada)).toEqual({ tipo: 'unknown' });
    expect(parseRespuesta(respuestaSinEstadoRegistro)).toEqual({ tipo: 'unknown' });
  });

  it('un EstadoRegistro desconocido -> unknown (fail-safe, no se acepta)', () => {
    const body = respuestaXml({ estadoEnvio: 'Correcto', estadoRegistro: 'Correcto' }).replace(
      '<tikR:EstadoRegistro>Correcto',
      '<tikR:EstadoRegistro>Raro',
    );
    expect(parseRespuesta({ status: 200, body })).toEqual({ tipo: 'unknown' });
  });

  it('S6.9 TiempoEsperaEnvio=90 se parsea como esperaS en todos los tipos con cuerpo', () => {
    const casos = [
      respuestaXml({ csv: CSV_EJEMPLO, tiempoEspera: 90, estadoEnvio: 'Correcto', estadoRegistro: 'Correcto' }),
      respuestaXml({ csv: CSV_EJEMPLO, tiempoEspera: 90, estadoEnvio: 'ParcialmenteCorrecto', estadoRegistro: 'AceptadoConErrores', codigoError: '2001', descripcionError: 'x' }),
      respuestaXml({ tiempoEspera: 90, estadoEnvio: 'Incorrecto', estadoRegistro: 'Incorrecto', codigoError: '1100', descripcionError: 'x' }),
    ];
    for (const body of casos) {
      const r = parseRespuesta({ status: 200, body });
      expect(r).toHaveProperty('esperaS', 90);
    }
  });

  it('sin TiempoEsperaEnvio -> esperaS ausente (el llamador usa el valor por defecto)', () => {
    const r = parseRespuesta({ status: 200, body: respuestaXml({ csv: CSV_EJEMPLO, estadoEnvio: 'Correcto', estadoRegistro: 'Correcto' }) });
    expect(r).toEqual({ tipo: 'correcto', csv: CSV_EJEMPLO });
  });
});

describe('parseRespuesta - duplicado (R6.3, R6.5)', () => {
  it('S6.7 3000 + RegistroDuplicado Correcta -> incorrecto con código del registro (no el anidado) y duplicado.estado', () => {
    const r = parseRespuesta(respuestaDuplicado('Correcta'));
    expect(r).toEqual({
      tipo: 'incorrecto',
      codigo: '3000',
      descripcion: 'Registro de facturación duplicado',
      duplicado: { idPeticion: 'PET-0001', estado: 'Correcta' },
      esperaS: 60,
    });
  });

  it('S6.8 AceptadaConErrores: el código del registro sigue siendo 3000 aunque el bloque anidado traiga 2004', () => {
    const r = parseRespuesta(respuestaDuplicado('AceptadaConErrores'));
    expect(r.tipo).toBe('incorrecto');
    if (r.tipo === 'incorrecto') {
      expect(r.codigo).toBe('3000');
      expect(r.descripcion).toBe('Registro de facturación duplicado');
      expect(r.duplicado).toEqual({ idPeticion: 'PET-0001', estado: 'AceptadaConErrores' });
    }
  });

  it('estado Anulada se propaga tal cual', () => {
    const r = parseRespuesta(respuestaDuplicado('Anulada'));
    expect(r.tipo === 'incorrecto' && r.duplicado?.estado).toBe('Anulada');
  });

  it('el duplicado respeta TiempoEsperaEnvio', () => {
    expect(parseRespuesta(respuestaDuplicado('Correcta', 90))).toHaveProperty('esperaS', 90);
  });

  it('un Incorrecto con duplicado pero código anidado y sin código a nivel de registro no inventa el anidado', () => {
    const body = respuestaXml({
      estadoEnvio: 'Incorrecto',
      estadoRegistro: 'Incorrecto',
      duplicado: { idPeticion: 'P', estado: 'Correcta', codigoError: '2004', descripcionError: 'anidado' },
    });
    const r = parseRespuesta({ status: 200, body });
    expect(r.tipo).toBe('incorrecto');
    if (r.tipo === 'incorrecto') {
      expect(r.codigo).toBeUndefined();
      expect(r.descripcion).toBeUndefined();
    }
  });
});
