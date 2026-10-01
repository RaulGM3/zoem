import { createHash } from 'node:crypto';
import type { TipoFactura } from './types';

// Huella (hash) de los registros Verifactu según la especificación oficial de AEAT
// (Veri-Factu_especificaciones_huella_hash_registros v0.1.2).

export interface CamposHuellaAlta {
  idEmisor: string;
  numSerie: string;
  /** dd-MM-yyyy */
  fecha: string;
  tipoFactura: TipoFactura;
  cuotaTotal: string;
  importeTotal: string;
  /** Huella del registro anterior; '' si es el primero de la cadena. */
  huellaAnterior: string;
  /** ISO 8601 con huso horario. */
  fechaHoraHuso: string;
}

export interface CamposHuellaAnulacion {
  idEmisor: string;
  numSerie: string;
  /** dd-MM-yyyy */
  fecha: string;
  huellaAnterior: string;
  fechaHoraHuso: string;
}

export function sha256Hex(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex').toUpperCase();
}

export function cadenaHuellaAlta(f: CamposHuellaAlta): string {
  return [
    `IDEmisorFactura=${f.idEmisor}`,
    `NumSerieFactura=${f.numSerie}`,
    `FechaExpedicionFactura=${f.fecha}`,
    `TipoFactura=${f.tipoFactura}`,
    `CuotaTotal=${f.cuotaTotal}`,
    `ImporteTotal=${f.importeTotal}`,
    `Huella=${f.huellaAnterior}`,
    `FechaHoraHusoGenRegistro=${f.fechaHoraHuso}`,
  ].join('&');
}

export function cadenaHuellaAnulacion(f: CamposHuellaAnulacion): string {
  return [
    `IDEmisorFacturaAnulada=${f.idEmisor}`,
    `NumSerieFacturaAnulada=${f.numSerie}`,
    `FechaExpedicionFacturaAnulada=${f.fecha}`,
    `Huella=${f.huellaAnterior}`,
    `FechaHoraHusoGenRegistro=${f.fechaHoraHuso}`,
  ].join('&');
}

export function huellaAlta(f: CamposHuellaAlta): string {
  return sha256Hex(cadenaHuellaAlta(f));
}

export function huellaAnulacion(f: CamposHuellaAnulacion): string {
  return sha256Hex(cadenaHuellaAnulacion(f));
}
