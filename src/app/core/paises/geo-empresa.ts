import { paisPorCodigo, type CodigoPais } from './catalogo-paises';

/**
 * Campos de región a escribir en la empresa: España guarda `ca` (Verifactu y plazos la leen);
 * el resto, `region`. `borrar` rellena el campo que NO aplica: en una edición se pasa `deleteField()`
 * para que no quede la región del país anterior; en una alta se omite y queda `undefined`.
 */
export function geoParaGuardar<T = undefined>(pais: CodigoPais, region: string, borrar?: T) {
  return pais === 'ES' ? { ca: region, region: borrar } : { region, ca: borrar };
}

/** Nombre legible de la región (`''` si falta o no es de ese país). */
export function nombreRegion(pais: CodigoPais, region: string | undefined): string {
  return paisPorCodigo(pais).regiones.find((r) => r.codigo === region)?.nombre ?? '';
}

/** Verifactu es una obligación española: solo se ofrece en España. */
export function verifactuDisponible(pais: CodigoPais): boolean {
  return pais === 'ES';
}
