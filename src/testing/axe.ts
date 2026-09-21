import axe, { type Result, type RunOptions } from 'axe-core';

/**
 * Reglas que jsdom NO puede evaluar de forma fiable porque no hace layout real
 * (sin geometría ni color computado sobre el árbol pintado). Se desactivan a
 * propósito: dejarlas activas produce falsos verdes, que es peor que no medir.
 *
 * IMPORTANTE: el contraste de color (WCAG AA 4.5:1) NO queda cubierto por estos
 * tests. Se verifica a mano en navegador o con axe DevTools.
 */
const REGLAS_NO_FIABLES_EN_JSDOM = ['color-contrast'] as const;

const OPCIONES: RunOptions = {
  rules: Object.fromEntries(
    REGLAS_NO_FIABLES_EN_JSDOM.map((id) => [id, { enabled: false }]),
  ),
  resultTypes: ['violations'],
};

/** Corre axe-core sobre un nodo y devuelve solo las violaciones. */
export async function analizarA11y(root: Element): Promise<Result[]> {
  const { violations } = await axe.run(root, OPCIONES);
  return violations;
}

/** Formatea las violaciones para que el fallo del test diga QUÉ arreglar y DÓNDE. */
export function formatearViolaciones(violations: Result[]): string {
  if (violations.length === 0) return 'sin violaciones';
  return violations
    .map((v) => {
      const nodos = v.nodes.map((n) => `      - ${n.target.join(' ')}`).join('\n');
      return `  [${v.impact ?? 'n/a'}] ${v.id}: ${v.help}\n${nodos}`;
    })
    .join('\n');
}
