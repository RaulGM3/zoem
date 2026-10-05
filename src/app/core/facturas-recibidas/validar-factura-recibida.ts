/**
 * Validación pura de una factura recibida antes de registrarla. Sin dependencias de framework.
 * v1: solo F1/F2 nacionales con clave de operación 01 (rectificativas y ISP quedan para v2).
 */

import type { LineaIvaRecibida, PeriodoIva } from '../../interfaces/factura-recibida.interface';
import { validarNif } from '../fiscal/nif';
import { comparaPeriodos, esFechaIso, trimestre } from './trimestre';

export interface DatosFacturaRecibida {
  tipoFactura: string;
  claveOperacion: string;
  proveedor: { nombre: string; nif: string };
  numero: string;
  fechaExpedicion: string;
  fechaRegistro: string;
  periodo303: PeriodoIva;
  lineasIva: readonly LineaIvaRecibida[];
  total: number;
  /** Ausente => 100. */
  porcentajeDeducible?: number;
}

export interface IncidenciaFactura {
  /** Ruta del campo, p. ej. `proveedor.nif` o `lineasIva.1.cuota`. */
  campo: string;
  mensaje: string;
}

export interface ResultadoValidacionFactura {
  ok: boolean;
  errores: IncidenciaFactura[];
  advertencias: IncidenciaFactura[];
  /** Valor efectivo (100 por defecto). */
  porcentajeDeducible: number;
}

/** Tolerancia de redondeo del libro (cuota y total). */
const TOLERANCIA = 0.011;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function validarFacturaRecibida(d: DatosFacturaRecibida): ResultadoValidacionFactura {
  const errores: IncidenciaFactura[] = [];
  const advertencias: IncidenciaFactura[] = [];
  const error = (campo: string, mensaje: string) => errores.push({ campo, mensaje });

  if (d.tipoFactura !== 'F1' && d.tipoFactura !== 'F2') error('tipoFactura', 'Solo se admiten facturas F1 y F2.');
  if (d.claveOperacion !== '01') error('claveOperacion', 'Solo se admite la clave de operación 01.');

  if (!d.proveedor.nombre.trim()) error('proveedor.nombre', 'El nombre del emisor es obligatorio.');
  if (!d.proveedor.nif.trim()) error('proveedor.nif', 'El NIF del emisor es obligatorio.');
  else if (!validarNif(d.proveedor.nif).ok) error('proveedor.nif', 'El NIF del emisor no es válido.');
  if (!d.numero.trim()) error('numero', 'El número de factura es obligatorio.');

  const expedicionOk = esFechaIso(d.fechaExpedicion);
  const registroOk = esFechaIso(d.fechaRegistro);
  if (!expedicionOk) error('fechaExpedicion', 'La fecha de expedición es obligatoria (aaaa-mm-dd).');
  if (!registroOk) error('fechaRegistro', 'La fecha de registro es obligatoria (aaaa-mm-dd).');
  if (expedicionOk && registroOk && d.fechaRegistro < d.fechaExpedicion) {
    error('fechaRegistro', 'La fecha de registro no puede ser anterior a la de expedición.');
  }

  const p = d.periodo303;
  const periodoOk =
    Number.isInteger(p.ejercicio) && p.ejercicio >= 2000 && p.ejercicio <= 2100 && [1, 2, 3, 4].includes(p.trimestre);
  if (!periodoOk) {
    error('periodo303', 'El periodo del modelo 303 no es válido.');
  } else {
    if (expedicionOk && comparaPeriodos(p, trimestre(d.fechaExpedicion)) < 0) {
      error('periodo303', 'El periodo no puede ser anterior al trimestre de la fecha de expedición.');
    } else if (registroOk && comparaPeriodos(p, trimestre(d.fechaRegistro)) < 0) {
      advertencias.push({ campo: 'periodo303', mensaje: 'El periodo es anterior al trimestre de la fecha de registro.' });
    }
  }

  if (d.lineasIva.length === 0) error('lineasIva', 'Añade al menos una línea de IVA.');
  let suma = 0;
  d.lineasIva.forEach((l, i) => {
    const ruta = `lineasIva.${i}`;
    suma += l.base + l.cuota;
    if (!Number.isFinite(l.base) || l.base < 0) error(`${ruta}.base`, 'La base debe ser un importe igual o mayor que 0.');
    if (!Number.isFinite(l.tipo) || l.tipo < 0 || l.tipo > 100) error(`${ruta}.tipo`, 'El tipo debe estar entre 0 y 100.');
    if (!Number.isFinite(l.cuota) || l.cuota < 0) {
      error(`${ruta}.cuota`, 'La cuota debe ser un importe igual o mayor que 0.');
    } else if (l.exento) {
      if (l.cuota !== 0) error(`${ruta}.cuota`, 'Una línea exenta no lleva cuota.');
      if (!l.causaExencion) error(`${ruta}.causaExencion`, 'Indica la causa de exención.');
    } else if (Number.isFinite(l.base) && Number.isFinite(l.tipo) && Math.abs(l.cuota - round2((l.base * l.tipo) / 100)) > TOLERANCIA) {
      error(`${ruta}.cuota`, 'La cuota no coincide con base × tipo.');
    }
  });
  if (!Number.isFinite(d.total) || Math.abs(d.total - suma) > TOLERANCIA) {
    error('total', 'El total no coincide con la suma de bases y cuotas.');
  }

  const pct = d.porcentajeDeducible ?? 100;
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) error('porcentajeDeducible', 'El porcentaje deducible debe estar entre 0 y 100.');

  return { ok: errores.length === 0, errores, advertencias, porcentajeDeducible: pct };
}
