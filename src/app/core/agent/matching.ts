/**
 * Resolución difusa de nombre a entidad — lógica PURA, sin Angular.
 *
 * El agente recibe lo que el usuario dijo ("la villa Garrapata", dictado y sin
 * tildes) y necesita convertirlo en un id real. El modelo NO debe adivinar ids:
 * llama a una tool de búsqueda, esta resuelve contra los datos que ya están en
 * memoria, y le devuelve candidatos. Si hay uno solo, actúa; si hay varios,
 * pregunta. Por eso el orden importa tanto como el filtro.
 */

/** Lo mínimo que necesita un candidato para poder ser buscado. */
export interface Rankable {
  id: string;
  /** Texto visible contra el que se busca (título del caso, nombre del contacto…). */
  label: string;
}

/** Marcador temporal para sacar la ñ del camino de la descomposición Unicode. */
const NTILDE = '';

/**
 * Minúsculas, sin acentos, sin espacios de más.
 * La ñ se preserva a propósito: en español distingue palabras (peña ≠ pena),
 * y NFD la descompondría en `n` + tilde combinante.
 */
export function normalizar(texto: string): string {
  return texto
    .replace(/ñ/gi, NTILDE)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(NTILDE)
    .join('ñ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const SIN_COINCIDENCIA = -1;

/** Puntúa una etiqueta contra la consulta. `null` = descartar. */
function puntuar(label: string, consulta: string, tokens: string[]): { score: number; pos: number } | null {
  if (label === consulta) return { score: 100, pos: 0 };
  if (label.startsWith(consulta)) return { score: 80, pos: 0 };

  const pos = label.indexOf(consulta);
  if (pos !== SIN_COINCIDENCIA) return { score: 60, pos };

  // Última oportunidad: todos los términos aparecen, en cualquier orden.
  // Sirve para "garrapata villa" cuando el título es "Villa Garrapata S.L.".
  if (tokens.length > 1 && tokens.every((t) => label.includes(t))) {
    return { score: 40, pos: Math.min(...tokens.map((t) => label.indexOf(t))) };
  }

  return null;
}

/**
 * Candidatos ordenados por relevancia. Devuelve los objetos ORIGINALES para que
 * la tool pueda exponer al modelo los campos que quiera (estado, tipo, etc.).
 *
 * Desempate: a igual puntuación gana la coincidencia más temprana y, si empatan,
 * la etiqueta más corta — una etiqueta corta que contiene la consulta es más
 * específica que una larga que la menciona de pasada.
 */
export function rankMatches<T extends Rankable>(
  items: readonly T[],
  consulta: string,
  limite = 10,
): T[] {
  const q = normalizar(consulta);
  if (!q) return [];

  const tokens = q.split(' ').filter(Boolean);

  return items
    .flatMap((item) => {
      const label = normalizar(item.label ?? '');
      if (!label) return [];
      const hit = puntuar(label, q, tokens);
      return hit ? [{ item, ...hit, largo: label.length }] : [];
    })
    .sort((a, b) => b.score - a.score || a.pos - b.pos || a.largo - b.largo)
    .slice(0, limite)
    .map((m) => m.item);
}
