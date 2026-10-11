/** Moneda local por país (misma tabla que `core/paises/catalogo-paises.ts`; el script no importa TypeScript). */
export const MONEDA_LOCAL = { ES: 'EUR', CO: 'COP', CL: 'CLP', MX: 'MXN' };

/**
 * Campos que faltan en una empresa: `pais` (ES por defecto) y `moneda` (la local de su país).
 * Idempotente: si ya están, devuelve `{}`. Nunca pisa un valor existente.
 */
export function parchePaisMoneda(data) {
  const pais = typeof data.pais === 'string' && data.pais ? data.pais : 'ES';
  const tienePais = data.pais !== undefined && data.pais !== null && data.pais !== '';
  const tieneMoneda = typeof data.moneda === 'string' && data.moneda !== '';
  return {
    ...(tienePais ? {} : { pais }),
    ...(tieneMoneda ? {} : { moneda: MONEDA_LOCAL[pais] ?? 'EUR' }),
  };
}
