import type { Guia } from './guia';

/**
 * Lógica PURA: qué guía explica la pantalla de una URL. La usa la ayuda
 * contextual del toolbar para proyectar en el modal la guía de la página actual.
 */

/** La guía general no documenta una pantalla: es la red cuando ninguna coincide. */
const GENERAL = 'general';

function segmentos(ruta: string): string[] {
  return ruta.split(/[?#]/)[0].split('/').filter(Boolean);
}

/** `base` coincide si sus segmentos son el principio de los de la URL. */
function coincide(base: readonly string[], url: readonly string[]): boolean {
  if (base.length === 0) return url.length === 0;
  return base.length <= url.length && base.every((s, i) => s === url[i]);
}

/**
 * Guía de la pantalla con la ruta más específica que encaje; las subpantallas
 * (`/casos/:id`) heredan la de su pantalla. Sin coincidencia, la guía general.
 */
export function guiaDeRuta(guias: readonly Guia[], url: string): Guia | undefined {
  const partes = segmentos(url);
  let mejor: { guia: Guia; largo: number } | undefined;

  for (const guia of guias) {
    if (guia.id === GENERAL) continue;
    for (const ruta of [guia.ruta, ...(guia.otrasRutas ?? [])]) {
      const base = segmentos(ruta);
      if (coincide(base, partes) && (!mejor || base.length > mejor.largo)) {
        mejor = { guia, largo: base.length };
      }
    }
  }

  return mejor?.guia ?? guias.find(g => g.id === GENERAL);
}
