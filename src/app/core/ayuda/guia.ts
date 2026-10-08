import type { Capability, Modulo } from '../permissions/permissions';

/**
 * Modelo de las guías de ayuda — solo tipos y catálogos, sin contenido.
 *
 * El contenido vive en `guias/` y se carga con import diferido (`cargar-guias.ts`).
 * Este archivo sí puede importarse desde el bundle inicial: la tool del agente
 * necesita `GUIA_IDS` para su esquema sin arrastrar el texto de las guías.
 */

export const GUIA_IDS = [
  'general',
  'contactos',
  'casos',
  'configuracion',
  'acciones',
  'calendario',
  'documentos',
  'facturacion',
  'tesoreria',
  'recepcion-ia',
  'agente-ia',
  'dashboard',
  'perfil',
] as const;

export type GuiaId = (typeof GUIA_IDS)[number];

/** Permiso que hace falta para ver una tarea. */
export interface RequisitoGuia {
  readonly modulo: Modulo;
  readonly capacidad: Capability;
}

export interface TareaGuia {
  readonly id: string;
  readonly titulo: string;
  /** Pasos en orden. Los textos de botones se copian literales de la pantalla. */
  readonly pasos: readonly string[];
  /** Sinónimos con los que el usuario puede buscar la tarea. */
  readonly claves: readonly string[];
  /**
   * Permiso propio de la tarea. Ausente = basta con ver la guía.
   * Lleva módulo porque una tarea puede exigir uno distinto al de su guía
   * (las plantillas de casos viven en Casos pero piden Configuración).
   */
  readonly requiere?: RequisitoGuia;
  readonly nota?: string;
}

export interface Guia {
  readonly id: GuiaId;
  readonly titulo: string;
  /** Módulo que hay que poder ver. `null` = guía general, visible para todos. */
  readonly modulo: Modulo | null;
  /** Ruta de la pantalla que documenta. */
  readonly ruta: string;
  /**
   * Otras pantallas que explica esta guía, además de `ruta` (p. ej. las
   * plantillas de caso viven en `/plantillas` pero se documentan en Casos).
   * La ayuda contextual del toolbar las usa para elegir la guía de la pantalla.
   */
  readonly otrasRutas?: readonly string[];
  readonly resumen: string;
  readonly paraQue: string;
  /**
   * Lo imprescindible de la pantalla en frases cortas: reglas, límites y
   * avisos que conviene conocer antes de usarla. Lo muestra el modal de ayuda.
   */
  readonly aSaber?: readonly string[];
  readonly tareas: readonly TareaGuia[];
  readonly claves: readonly string[];
}

/** Consulta de permisos que reciben las funciones puras; en la app es `PermissionService.can`. */
export type PuedeFn = (modulo: Modulo, capacidad: Capability) => boolean;
