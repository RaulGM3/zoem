/** Utilidades puras de periodo (trimestre natural) para el IVA soportado. Sin dependencias de framework. */

import type { PeriodoIva, TrimestreIva } from '../../interfaces/factura-recibida.interface';

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `true` si `fecha` es una fecha ISO `yyyy-MM-dd` real (rechaza 2026-02-30). */
export function esFechaIso(fecha: string): boolean {
  const m = RE_ISO.exec(fecha);
  if (!m) return false;
  const [y, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(y, mes - 1, dia));
  return d.getUTCFullYear() === y && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** Periodo (ejercicio + trimestre) de una fecha ISO. Lanza si la fecha no es válida. */
export function trimestre(fechaIso: string): PeriodoIva {
  if (!esFechaIso(fechaIso)) throw new Error(`Fecha ISO inválida: "${fechaIso}"`);
  const mes = Number(fechaIso.slice(5, 7));
  return { ejercicio: Number(fechaIso.slice(0, 4)), trimestre: (Math.ceil(mes / 3) as TrimestreIva) };
}

/** Negativo si `a` es anterior a `b`, 0 si coinciden, positivo si es posterior. */
export function comparaPeriodos(a: PeriodoIva, b: PeriodoIva): number {
  return a.ejercicio - b.ejercicio || a.trimestre - b.trimestre;
}
