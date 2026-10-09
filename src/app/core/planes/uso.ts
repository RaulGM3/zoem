import type { Limite } from './catalogo';

/**
 * Contadores de uso (los escriben las Functions; ver functions/src/uso/uso.ts):
 *   companies/{cid}/uso/total     → usuarios, plantillas, casosActivos, contactos, documentosBytes
 *   companies/{cid}/uso/{yyyy-mm} → accionesMes, iaMensajesMes (mes en la zona horaria de la empresa)
 */
export type UsoDoc = Partial<Record<
  'usuarios' | 'plantillas' | 'casosActivos' | 'contactos' | 'documentosBytes' | 'accionesMes' | 'iaMensajesMes',
  number
>>;

const MB = 1_048_576;

export function usadoDe(limite: Limite, total: UsoDoc, mes: UsoDoc): number {
  switch (limite) {
    case 'documentosMB': return Math.ceil((total.documentosBytes ?? 0) / MB);
    case 'accionesMes': return mes.accionesMes ?? 0;
    case 'iaMensajesMes': return mes.iaMensajesMes ?? 0;
    default: return total[limite] ?? 0;
  }
}
