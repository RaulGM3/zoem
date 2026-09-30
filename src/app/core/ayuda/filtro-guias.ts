import type { Guia, PuedeFn } from './guia';

/**
 * Lógica PURA de visibilidad de las guías — sin Angular, sin signals, sin DI.
 * La comparten la página de ayuda y la tool del agente, para que ninguno de los
 * dos enseñe a un usuario cómo hacer algo que no tiene permiso de hacer.
 */

/**
 * Guías que el usuario puede leer, cada una solo con las tareas que puede ejecutar.
 * No muta la entrada y respeta su orden.
 *
 * Una guía que se queda sin tareas sigue saliendo: quien solo puede ver un
 * módulo igual necesita saber para qué sirve.
 */
export function guiasVisibles(guias: readonly Guia[], puede: PuedeFn): Guia[] {
  return guias
    .filter(g => g.modulo === null || puede(g.modulo, 'ver'))
    .map(g => ({
      ...g,
      tareas: g.tareas.filter(t => !t.requiere || puede(t.requiere.modulo, t.requiere.capacidad)),
    }));
}

/** Busca por id. Recibe `string` porque el id llega de la URL o del modelo, sin validar. */
export function guiaPorId(guias: readonly Guia[], id: string): Guia | undefined {
  return guias.find(g => g.id === id);
}
