import type { Guia, TareaGuia } from './guia';

/**
 * Lógica PURA de búsqueda en las guías — sin Angular, sin signals, sin DI.
 * La usan la página de ayuda (lo que teclea el usuario) y la tool del agente
 * (lo que pregunta el modelo), así que tiene que tolerar tanto palabras sueltas
 * como una pregunta entera.
 */

export interface ResultadoGuia {
  readonly guia: Guia;
  /** Tareas que coinciden. Si coincide la guía y ninguna tarea, van todas. */
  readonly tareas: readonly TareaGuia[];
  /** Relevancia: 0 sin consulta, mayor cuanto mejor la coincidencia. */
  readonly puntos: number;
}

/** Dónde pesa más una coincidencia. El título de la tarea es lo que el usuario busca. */
const PESO = { tituloTarea: 8, clavesTarea: 5, pasosTarea: 2, guia: 1 } as const;

/**
 * Palabras que no aportan a la búsqueda. Sin esto, "¿cómo puedo crear un
 * contacto?" exigiría que la tarea contuviera "cómo" y "puedo".
 */
const PALABRAS_VACIAS = new Set([
  'a', 'al', 'como', 'con', 'cual', 'de', 'del', 'donde', 'el', 'en', 'es', 'esta', 'hace', 'hacer',
  'hago', 'la', 'las', 'lo', 'los', 'me', 'mi', 'para', 'por', 'puede', 'puedo', 'que', 'se', 'sirve',
  'su', 'un', 'una', 'uno', 'y',
]);

/**
 * Normaliza para comparar: minúsculas y sin diacríticos, de forma que
 * "Tesorería" y "tesoreria" sean la misma cadena.
 */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Quita el plural para que "plantillas" encuentre "plantilla". Basta porque se compara por subcadena. */
function singular(palabra: string): string {
  if (palabra.length > 4 && palabra.endsWith('es')) return palabra.slice(0, -2);
  if (palabra.length > 3 && palabra.endsWith('s')) return palabra.slice(0, -1);
  return palabra;
}

/** Trocea la consulta en términos útiles: sin signos, sin palabras vacías, en singular. */
function terminos(consulta: string): string[] {
  return normalizar(consulta)
    .split(/[^a-z0-9ñ]+/)
    .filter(p => p.length > 0 && !PALABRAS_VACIAS.has(p))
    .map(singular);
}

/** Puntos de una tarea, o 0 si no cumple TODOS los términos (AND). */
function puntuarTarea(tarea: TareaGuia, contextoGuia: string, busqueda: readonly string[]): number {
  const titulo = normalizar(tarea.titulo);
  const claves = normalizar(tarea.claves.join(' '));
  const pasos = normalizar(`${tarea.pasos.join(' ')} ${tarea.nota ?? ''}`);

  let puntos = 0;
  let algunoEnTarea = false;
  for (const termino of busqueda) {
    if (titulo.includes(termino)) puntos += PESO.tituloTarea;
    else if (claves.includes(termino)) puntos += PESO.clavesTarea;
    else if (pasos.includes(termino)) puntos += PESO.pasosTarea;
    else if (contextoGuia.includes(termino)) {
      // El término habla de la guía ("tesorería registrar"): vale, pero no basta solo.
      puntos += PESO.guia;
      continue;
    } else return 0;
    algunoEnTarea = true;
  }
  return algunoEnTarea ? puntos : 0;
}

/**
 * Busca en las guías sin mutarlas. Ordena por relevancia y, en caso de empate,
 * conserva el orden de entrada.
 *
 * Una consulta vacía (o hecha solo de palabras vacías) devuelve todo tal cual:
 * es el estado inicial de la página de ayuda.
 */
export function buscarGuias(guias: readonly Guia[], consulta: string): ResultadoGuia[] {
  const busqueda = terminos(consulta);
  if (busqueda.length === 0) return guias.map(guia => ({ guia, tareas: guia.tareas, puntos: 0 }));

  const resultados: ResultadoGuia[] = [];
  for (const guia of guias) {
    const contexto = normalizar(`${guia.titulo} ${guia.claves.join(' ')}`);

    const puntuadas = guia.tareas
      .map(tarea => ({ tarea, puntos: puntuarTarea(tarea, contexto, busqueda) }))
      .filter(p => p.puntos > 0);

    if (puntuadas.length > 0) {
      resultados.push({
        guia,
        tareas: puntuadas.map(p => p.tarea),
        puntos: Math.max(...puntuadas.map(p => p.puntos)),
      });
      continue;
    }

    const textoGuia = normalizar(`${contexto} ${guia.resumen} ${guia.paraQue}`);
    if (busqueda.every(termino => textoGuia.includes(termino))) {
      resultados.push({ guia, tareas: guia.tareas, puntos: PESO.guia * busqueda.length });
    }
  }

  // `sort` es estable: a igualdad de puntos se respeta el orden de entrada.
  return resultados.sort((a, b) => b.puntos - a.puntos);
}
