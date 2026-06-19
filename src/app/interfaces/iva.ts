/**
 * Módulo puro de IVA (España). Sin dependencias de framework.
 *
 * Regla del modelo: el `importe` de un movimiento es SIEMPRE el total de caja
 * movido (base + cuota). Aquí lo desglosamos hacia atrás para obtener base
 * imponible y cuota, de forma que `baseImponible + cuotaIva === importe`.
 */

/** Tipos de IVA vigentes en España (general, reducido, superreducido, exento/no sujeto). */
export const TIPOS_IVA = [21, 10, 4, 0] as const;

export type TipoIva = (typeof TIPOS_IVA)[number];

export interface DesgloseIva {
  baseImponible: number;
  cuotaIva: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Desglosa un importe TOTAL en base imponible y cuota de IVA.
 *
 * @param total   Importe total de caja (base + IVA).
 * @param tipoIva Porcentaje de IVA (21 | 10 | 4 | 0).
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
