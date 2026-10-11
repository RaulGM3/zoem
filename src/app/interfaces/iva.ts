/**
 * Módulo puro de IVA. Los tipos vigentes salen del catálogo de países; las causas de exención (LIVA) son solo de España. Sin dependencias de framework.
 *
 * Regla del modelo: el `importe` de un movimiento es SIEMPRE el total de caja
 * movido (base + cuota). Aquí lo desglosamos hacia atrás para obtener base
 * imponible y cuota, de forma que `baseImponible + cuotaIva === importe`.
 */

import { paisPorCodigo, type CodigoPais } from '../core/paises/catalogo-paises';
import type { CausaExencion } from './verifactu.interface';

/** Tipo de IVA en porcentaje (21, 16, 0...). Cada país tiene los suyos (ver `tiposIva`). */
export type TipoIva = number;

/** Tipos de IVA vigentes en el país (general, reducidos y exento/no sujeto), de mayor a menor. */
export function tiposIva(pais: CodigoPais): readonly number[] {
  return paisPorCodigo(pais).tiposIva;
}

/** Tipo general del país, en porcentaje (ES 21, MX 16, CO/CL 19). */
export function ivaPorDefecto(pais: CodigoPais): number {
  return paisPorCodigo(pais).ivaPorDefecto;
}

/**
 * Tipo de IVA (fracción) con el que nacen las líneas nuevas de una factura. España conserva el 10 %
 * histórico de Zoem; el resto de países arranca en su tipo general.
 */
export function ivaLineaNueva(pais: CodigoPais): number {
  return pais === 'ES' ? 0.1 : ivaPorDefecto(pais) / 100;
}

/**
 * Opciones para un selector de tipo de IVA: los tipos vigentes del país más los `extra`
 * que no estén en la lista (documentos antiguos o de otro país con un tipo distinto), de mayor a menor.
 */
export function opcionesIva(pais: CodigoPais, extra: readonly (number | null | undefined)[]): number[] {
  const tipos = new Set<number>(tiposIva(pais));
  for (const t of extra) {
    if (t != null) tipos.add(Math.round(t));
  }
  return [...tipos].sort((a, b) => b - a);
}

export interface DesgloseIva {
  baseImponible: number;
  cuotaIva: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Desglosa un importe TOTAL en base imponible y cuota de IVA.
 *
 * @param total   Importe total de caja (base + IVA).
 * @param tipoIva Porcentaje de IVA (21, 16, 0...).
 * @param exento  `true` para operaciones exentas/no sujetas (p. ej. suplidos): toda la base, cuota 0.
 *
 * La cuota se calcula como `total - base` para garantizar que el desglose
 * suma exactamente el total sin arrastrar errores de redondeo.
 */
export function desglosarIva(total: number, tipoIva: TipoIva, exento: boolean): DesgloseIva {
  if (exento || tipoIva === 0) return { baseImponible: round2(total), cuotaIva: 0 };
  const base = round2(total / (1 + tipoIva / 100));
  return { baseImponible: base, cuotaIva: round2(total - base) };
}

/** Calcula IVA sobre una BASE imponible (precio sin IVA). */
export function calcularIvaDesdeBase(base: number, tipoIva: TipoIva, exento: boolean): DesgloseIva {
  if (exento || tipoIva === 0) return { baseImponible: round2(base), cuotaIva: 0 };
  const cuotaIva = round2(base * tipoIva / 100);
  return { baseImponible: round2(base), cuotaIva };
}

/** Causas de exención (E1..E6) y de no sujeción (N1, N2) que admite el registro Verifactu. */
export const CAUSAS_EXENCION: readonly CausaExencion[] = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'N1', 'N2'];

/**
 * Etiquetas de las causas. Solo se citan artículos de la LIVA donde la causa los
 * fija sin ambigüedad; el resto queda genérico hasta confirmar el texto oficial.
 */
export const CAUSA_EXENCION_LABELS: Readonly<Record<CausaExencion, string>> = {
  E1: 'E1 · Exenta por el art. 20 LIVA',
  E2: 'E2 · Exenta por el art. 21 LIVA (exportaciones)',
  E3: 'E3 · Exenta por el art. 22 LIVA (asimiladas a exportaciones)',
  E4: 'E4 · Exenta por los arts. 23 y 24 LIVA (regímenes aduaneros)',
  E5: 'E5 · Exenta por el art. 25 LIVA (entregas intracomunitarias)',
  E6: 'E6 · Exenta por otros motivos',
  N1: 'N1 · No sujeta (art. 7, 14 u otros)',
  N2: 'N2 · No sujeta por reglas de localización',
};

/** Tipo de IVA efectivo de una línea (0..1): sin IVA es 0; sin tipo propio hereda el global. */
export function tasaEfectivaLinea(
  linea: { aplicaIva: boolean; ivaRate?: number | null },
  ivaGlobal: number,
): number {
  return linea.aplicaIva ? (linea.ivaRate ?? ivaGlobal) : 0;
}

/**
 * La línea es exenta o no sujeta (y por tanto necesita causa) si no lleva IVA o su
 * tipo efectivo es 0. Espejo de `esLineaExenta` en functions/src/aeat/desglose.ts
 * (no hay código compartido por el rootDir de functions).
 */
export function esLineaExenta(
  linea: { aplicaIva: boolean; ivaRate?: number | null },
  ivaGlobal: number,
): boolean {
  return !linea.aplicaIva || tasaEfectivaLinea(linea, ivaGlobal) === 0;
}
