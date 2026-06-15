import type { HitoActividad, HitoActividadTipo } from '../../interfaces';
import { HITO_ESTADO_LABEL } from './hito-estado';

/**
 * Presentación pura (sin framework) del feed de actividad de hitos.
 * La fuente de verdad de los verbos y colores vive acá: ningún consumidor
 * debe reinventar el texto de "quién le dio a qué".
 */

/** Verbo en pasado para cada acción. */
export const HITO_ACTIVIDAD_VERBO: Record<HitoActividadTipo, string> = {
  creado: 'creó',
  editado: 'editó',
  estado: 'cambió el estado de',
  eliminado: 'eliminó',
};

/** Color del punto/línea de la timeline según la acción. */
export const HITO_ACTIVIDAD_DOT_CLASS: Record<HitoActividadTipo, string> = {
  creado: 'bg-violet-500',
  editado: 'bg-blue-500',
  estado: 'bg-emerald-500',
  eliminado: 'bg-red-400',
};

/**
 * Frase legible completa de un evento, p.ej.:
 *   "Raúl cambió el estado de «Presentar demanda» a Completado"
 * `autorNombre` lo resuelve el consumidor (necesita los members).
 */
export function describeActividad(act: HitoActividad, autorNombre: string): string {
  const verbo = HITO_ACTIVIDAD_VERBO[act.tipo];
  const base = `${autorNombre} ${verbo} «${act.hitoTitulo}»`;
  if (act.tipo === 'estado' && act.estadoNuevo) {
    return `${base} a ${HITO_ESTADO_LABEL[act.estadoNuevo]}`;
  }
  return base;
}
