import type { Guia } from './guia';

/**
 * Único punto de entrada al contenido de las guías.
 *
 * El `import()` dinámico deja el texto en un chunk aparte: la tool del agente
 * vive en el bundle inicial y no puede arrastrar varias pantallas de prosa al
 * arranque de la app.
 */
export const cargarGuias = (): Promise<readonly Guia[]> => import('./guias').then(m => m.GUIAS);
