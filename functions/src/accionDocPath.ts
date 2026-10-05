/**
 * Lógica pura del callable `accionDocUrl` (separada para poder testearla sin
 * firebase-admin).
 */

/**
 * Las URLs firmadas V4 de GCS admiten como máximo 7 días. La idea de producto
 * eran 30, pero V4 no lo permite (V2 sí, pero está en desuso); se prefiere el
 * máximo válido de V4 antes que degradar a un esquema legacy.
 */
export const DIAS_VALIDEZ_ENLACE = 7;
export const EXPIRA_ENLACE_MS = DIAS_VALIDEZ_ENLACE * 24 * 60 * 60 * 1000;

const ID_SEGURO = /^[A-Za-z0-9_-]+$/;

/**
 * El path debe ser `companies/{companyId}/acciones_envios/{id}.docx`, sin
 * subcarpetas ni traversal, y pertenecer al tenant del caller.
 */
export function validarRutaEnvio(companyId: string, path: string): boolean {
  if (typeof companyId !== 'string' || typeof path !== 'string') return false;
  if (!ID_SEGURO.test(companyId)) return false;
  const prefijo = `companies/${companyId}/acciones_envios/`;
  if (!path.startsWith(prefijo)) return false;
  const archivo = path.slice(prefijo.length);
  return /^[A-Za-z0-9_-]+\.docx$/.test(archivo);
}
