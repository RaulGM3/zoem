import type { Guia, TareaGuia } from './guia';

/**
 * Lógica PURA: convierte una guía en texto compacto para el modelo.
 * Cada carácter que sale de aquí son tokens en cada consulta, por eso va sin
 * las claves de búsqueda y con un tope.
 */

/** Tope por guía. Tres guías a este tamaño siguen siendo una respuesta de tool razonable. */
export const TOPE_GUIA = 1800;

export const AVISO_MAS_TAREAS = '(Hay más tareas de esta guía en la página Ayuda.)';

function serializarTarea(tarea: TareaGuia): string {
  const lineas = [`Tarea: ${tarea.titulo}`, ...tarea.pasos.map((paso, i) => `${i + 1}. ${paso}`)];
  if (tarea.nota) lineas.push(`Nota: ${tarea.nota}`);
  return lineas.join('\n');
}

/**
 * Texto de la guía con las tareas indicadas (por defecto, todas).
 *
 * Si no cabe en `tope`, deja fuera las últimas tareas ENTERAS y lo avisa:
 * medio paso a paso es peor que ninguno, porque el modelo completaría el resto.
 */
export function serializarGuia(
  guia: Guia,
  tareas: readonly TareaGuia[] = guia.tareas,
  tope: number = TOPE_GUIA,
): string {
  const encabezado = [`Guía: ${guia.titulo} (pantalla: ${guia.ruta})`, guia.resumen, `Para qué sirve: ${guia.paraQue}`].join('\n');

  const bloques = [encabezado];
  let largo = encabezado.length;
  const reserva = AVISO_MAS_TAREAS.length + 2;

  for (const [i, tarea] of tareas.entries()) {
    const bloque = serializarTarea(tarea);
    const quedanMas = i < tareas.length - 1;
    const necesario = largo + 2 + bloque.length + (quedanMas ? reserva : 0);
    if (necesario > tope) {
      bloques.push(AVISO_MAS_TAREAS);
      break;
    }
    bloques.push(bloque);
    largo += 2 + bloque.length;
  }

  return bloques.join('\n\n');
}
