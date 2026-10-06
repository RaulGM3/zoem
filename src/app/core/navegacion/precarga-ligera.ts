import { Injectable } from '@angular/core';
import type { PreloadingStrategy, Route } from '@angular/router';
import { type Observable, of } from 'rxjs';

/** Subconjunto de la Network Information API (no está en todos los navegadores). */
export interface ConexionRed {
  saveData?: boolean;
  effectiveType?: string;
}

const CONEXIONES_LENTAS = new Set(['slow-2g', '2g']);

/**
 * Decide si una ruta lazy se precarga en segundo plano.
 * No precarga si la ruta lo desactiva (`data: { preload: false }`), si el usuario
 * activó el ahorro de datos o si la conexión es 2G: ahí la precarga compite con
 * las peticiones de la página actual en vez de ayudar.
 */
export function debePrecargar(route: Route, conexion: ConexionRed | undefined): boolean {
  if (route.data?.['preload'] === false) return false;
  if (conexion?.saveData) return false;
  return !CONEXIONES_LENTAS.has(conexion?.effectiveType ?? '');
}

function conexionActual(): ConexionRed | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: ConexionRed }).connection;
}

/**
 * Precarga los chunks de las rutas tras la primera navegación, para que al hacer
 * clic el JS ya esté en caché y solo quede esperar a los datos.
 */
@Injectable({ providedIn: 'root' })
export class PrecargaLigera implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return debePrecargar(route, conexionActual()) ? load() : of(null);
  }
}
