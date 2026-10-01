// Fixtures de respuestas de AEAT (SOAP) para los tests de parseRespuesta.
// Construidas a partir de la estructura documentada en RespuestaSuministro.xsd
// (design: sección 2 "Response"). Los prefijos varían a propósito entre fixtures:
// el parser debe emparejar por nombre local.

import type { HttpRespuesta } from '../parseResponse';

export type { HttpRespuesta };

const NS_BASE = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws';

export type EstadoRegistroXml = 'Correcto' | 'AceptadoConErrores' | 'Incorrecto';
export type EstadoEnvioXml = 'Correcto' | 'ParcialmenteCorrecto' | 'Incorrecto';

export interface OpcionesRespuesta {
  csv?: string;
  tiempoEspera?: number;
  estadoEnvio: EstadoEnvioXml;
  estadoRegistro: EstadoRegistroXml;
  codigoError?: string;
  descripcionError?: string;
  duplicado?: {
    idPeticion: string;
    estado: 'Correcta' | 'AceptadaConErrores' | 'Anulada';
    codigoError?: string;
    descripcionError?: string;
  };
}

/** Respuesta 200 de un envío de un registro (alta) con los prefijos habituales. */
export function respuestaXml(o: OpcionesRespuesta): string {
  const duplicado = o.duplicado
    ? `<tikR:RegistroDuplicado>
          <tikR:IdPeticionRegistroDuplicado>${o.duplicado.idPeticion}</tikR:IdPeticionRegistroDuplicado>
          <tikR:EstadoRegistroDuplicado>${o.duplicado.estado}</tikR:EstadoRegistroDuplicado>${
            o.duplicado.codigoError ? `\n          <tikR:CodigoErrorRegistro>${o.duplicado.codigoError}</tikR:CodigoErrorRegistro>` : ''
          }${
            o.duplicado.descripcionError
              ? `\n          <tikR:DescripcionErrorRegistro>${o.duplicado.descripcionError}</tikR:DescripcionErrorRegistro>`
              : ''
          }
        </tikR:RegistroDuplicado>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Header/>
  <env:Body>
    <tikR:RespuestaRegFactuSistemaFacturacion xmlns:tikR="${NS_BASE}/RespuestaSuministro.xsd" xmlns:tik="${NS_BASE}/SuministroInformacion.xsd">${
      o.csv ? `\n      <tikR:CSV>${o.csv}</tikR:CSV>` : ''
    }
      <tikR:DatosPresentacion>
        <tik:NIFPresentador>B76543210</tik:NIFPresentador>
        <tik:TimestampPresentacion>2026-03-15T11:20:31+01:00</tik:TimestampPresentacion>
      </tikR:DatosPresentacion>
      <tikR:Cabecera>
        <tik:ObligadoEmision>
          <tik:NombreRazon>Despacho SL</tik:NombreRazon>
          <tik:NIF>B76543210</tik:NIF>
        </tik:ObligadoEmision>
      </tikR:Cabecera>${o.tiempoEspera !== undefined ? `\n      <tikR:TiempoEsperaEnvio>${o.tiempoEspera}</tikR:TiempoEsperaEnvio>` : ''}
      <tikR:EstadoEnvio>${o.estadoEnvio}</tikR:EstadoEnvio>
      <tikR:RespuestaLinea>
        <tikR:IDFactura>
          <tik:IDEmisorFactura>B76543210</tik:IDEmisorFactura>
          <tik:NumSerieFactura>F-2026-001</tik:NumSerieFactura>
          <tik:FechaExpedicionFactura>15-03-2026</tik:FechaExpedicionFactura>
        </tikR:IDFactura>
        <tikR:Operacion>
          <tik:TipoOperacion>Alta</tik:TipoOperacion>
        </tikR:Operacion>
        <tikR:EstadoRegistro>${o.estadoRegistro}</tikR:EstadoRegistro>${
          o.codigoError ? `\n        <tikR:CodigoErrorRegistro>${o.codigoError}</tikR:CodigoErrorRegistro>` : ''
        }${
          o.descripcionError ? `\n        <tikR:DescripcionErrorRegistro>${o.descripcionError}</tikR:DescripcionErrorRegistro>` : ''
        }${duplicado ? `\n        ${duplicado}` : ''}
      </tikR:RespuestaLinea>
    </tikR:RespuestaRegFactuSistemaFacturacion>
  </env:Body>
</env:Envelope>`;
}

export const CSV_EJEMPLO = 'A-ABCD1234EFGH5678';

/** Registro aceptado, con CSV y espera de 60 s. */
export const respuestaCorrecto: HttpRespuesta = {
  status: 200,
  body: respuestaXml({ csv: CSV_EJEMPLO, tiempoEspera: 60, estadoEnvio: 'Correcto', estadoRegistro: 'Correcto' }),
};

/** Mismo caso, con prefijos distintos y namespace por defecto (no hay que depender del prefijo). */
export const respuestaCorrectoOtrosPrefijos: HttpRespuesta = {
  status: 200,
  body: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<RespuestaRegFactuSistemaFacturacion xmlns="${NS_BASE}/RespuestaSuministro.xsd">
<CSV>${CSV_EJEMPLO}</CSV><TiempoEsperaEnvio>60</TiempoEsperaEnvio><EstadoEnvio>Correcto</EstadoEnvio>
<RespuestaLinea><EstadoRegistro>Correcto</EstadoRegistro></RespuestaLinea>
</RespuestaRegFactuSistemaFacturacion></soap:Body></soap:Envelope>`,
};

/** Aceptado con errores admisibles (2001). */
export const respuestaAceptadoConErrores: HttpRespuesta = {
  status: 200,
  body: respuestaXml({
    csv: CSV_EJEMPLO,
    tiempoEspera: 60,
    estadoEnvio: 'ParcialmenteCorrecto',
    estadoRegistro: 'AceptadoConErrores',
    codigoError: '2001',
    descripcionError: 'Aviso: error admisible en el registro',
  }),
};

/** Registro rechazado (Incorrecto) con código 1xxx; sin CSV. */
export const respuestaIncorrecto: HttpRespuesta = {
  status: 200,
  body: respuestaXml({
    tiempoEspera: 60,
    estadoEnvio: 'Incorrecto',
    estadoRegistro: 'Incorrecto',
    codigoError: '1100',
    descripcionError: 'Valor del campo incorrecto',
  }),
};

/** Reenvío de un registro ya registrado: 3000 + bloque RegistroDuplicado (con su propio código anidado). */
export function respuestaDuplicado(estado: 'Correcta' | 'AceptadaConErrores' | 'Anulada', tiempoEspera = 60): HttpRespuesta {
  return {
    status: 200,
    body: respuestaXml({
      tiempoEspera,
      estadoEnvio: 'Incorrecto',
      estadoRegistro: 'Incorrecto',
      codigoError: '3000',
      descripcionError: 'Registro de facturación duplicado',
      duplicado: {
        idPeticion: 'PET-0001',
        estado,
        // Código anidado distinto a propósito: el parser no debe confundirlo con el del registro.
        codigoError: estado === 'AceptadaConErrores' ? '2004' : undefined,
        descripcionError: estado === 'AceptadaConErrores' ? 'Aviso en el registro original' : undefined,
      },
    }),
  };
}

/** Rechazo a nivel de sobre: SOAP Fault (p. ej. 4104). */
export const respuestaFault4104: HttpRespuesta = {
  status: 500,
  body: `<?xml version="1.0" encoding="UTF-8"?>
<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>
<env:Fault><faultcode>env:Client</faultcode><faultstring>Codigo[4104].El valor del campo NIF del bloque ObligadoEmision no es válido.</faultstring></env:Fault>
</env:Body></env:Envelope>`,
};

/** Fault con status 200 (algunos gateways lo hacen): debe seguir siendo fault. */
export const respuestaFault200: HttpRespuesta = { status: 200, body: respuestaFault4104.body };

export const respuestaHttp500Html: HttpRespuesta = {
  status: 500,
  body: '<html><head><title>500 Internal Server Error</title></head><body><h1>Internal Server Error</h1></body></html>',
};

export const respuestaHttp503: HttpRespuesta = { status: 503, body: 'Service Unavailable' };

export const respuestaVacia: HttpRespuesta = { status: 200, body: '' };

/** 200 con estructura de respuesta pero sin EstadoRegistro. */
export const respuestaSinEstadoRegistro: HttpRespuesta = {
  status: 200,
  body: `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>
<tikR:RespuestaRegFactuSistemaFacturacion xmlns:tikR="${NS_BASE}/RespuestaSuministro.xsd">
<tikR:TiempoEsperaEnvio>60</tikR:TiempoEsperaEnvio><tikR:EstadoEnvio>Correcto</tikR:EstadoEnvio>
<tikR:RespuestaLinea></tikR:RespuestaLinea>
</tikR:RespuestaRegFactuSistemaFacturacion></env:Body></env:Envelope>`,
};

export const respuestaMalformada: HttpRespuesta = {
  status: 200,
  body: '<env:Envelope><env:Body><tikR:RespuestaRegFactuSistemaFacturacion><tikR:EstadoEnvio>Correcto</tikR:Estado',
};

export const respuestaTextoBasura: HttpRespuesta = { status: 200, body: 'esto no es xml' };
