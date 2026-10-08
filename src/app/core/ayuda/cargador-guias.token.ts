import { InjectionToken } from '@angular/core';
import { cargarGuias } from './cargar-guias';
import type { Guia } from './guia';

/**
 * De dónde salen las guías. Es un token para que los tests inyecten guías de
 * juguete; en la app resuelve al import diferido del contenido real.
 *
 * Vive en `core` y no en la página de ayuda: la ayuda contextual del toolbar
 * también lo usa, y no debe arrastrar la página entera al chunk del layout.
 */
export const CARGADOR_GUIAS = new InjectionToken<() => Promise<readonly Guia[]>>('CARGADOR_GUIAS', {
  providedIn: 'root',
  factory: () => cargarGuias,
});
