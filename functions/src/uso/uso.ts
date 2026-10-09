/**
 * Contadores de uso por empresa (lógica PURA + un adaptador mínimo de escritura).
 *
 *   companies/{cid}/uso/total     → casosActivos, contactos, plantillas, usuarios, documentosBytes
 *   companies/{cid}/uso/{yyyy-mm} → accionesMes, iaMensajesMes
 *
 * Los mantienen triggers (Admin SDK); los clientes SOLO leen. Las security rules consultan estos docs
 * para dejar crear o no. Son EVENTUALMENTE consistentes (el trigger tarda ~1 s): varias altas
 * simultáneas pueden pasarse del cupo en unas pocas unidades. Se acepta (soft limit).
 */

export type TipoUso = 'caso' | 'contacto' | 'plantilla' | 'miembro' | 'archivo' | 'accion';
export type CampoUso = 'casosActivos' | 'contactos' | 'plantillas' | 'usuarios' | 'documentosBytes' | 'accionesMes' | 'iaMensajesMes';
type Datos = Record<string, unknown> | undefined;

export const CAMPO_DE: Record<TipoUso, CampoUso> = {
  caso: 'casosActivos', contacto: 'contactos', plantilla: 'plantillas', miembro: 'usuarios', archivo: 'documentosBytes', accion: 'accionesMes',
};

const ESTADOS_CASO_ACTIVO = new Set(['pendiente', 'en_proceso', 'urgente']);

export function claveMes(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Cuánto "pesa" un doc en su contador (0 si no cuenta). */
function valor(tipo: TipoUso, id: string, d: Datos, esDemo: boolean): number {
  if (!d) return 0;
  // El seed de la demo (ids `demo-…`) no gasta el cupo de la persona. Solo en empresas demo:
  // en una empresa real un id `demo-…` cuenta como cualquier otro.
  if (esDemo && tipo !== 'miembro' && id.startsWith('demo-')) return 0;
  switch (tipo) {
    case 'caso': return ESTADOS_CASO_ACTIVO.has(String(d['estado'])) ? 1 : 0;
    case 'contacto': return d['deleted'] === true ? 0 : 1;
    case 'plantilla':
    case 'accion': return 1;
    case 'miembro': return d['estado'] === 'activo' ? 1 : 0;
    case 'archivo': {
      const bytes = d['sizeBytes'];
      return d['deleted'] === true || typeof bytes !== 'number' || bytes < 0 ? 0 : bytes;
    }
  }
}

export function deltaUso(tipo: TipoUso, id: string, antes: Datos, despues: Datos, esDemo: boolean): number {
  return valor(tipo, id, despues, esDemo) - valor(tipo, id, antes, esDemo);
}

/** Escritura mínima de contadores (inyectable: en producción es `FieldValue.increment`). */
export interface UsoDb {
  sumar(path: string, campo: CampoUso, delta: number): Promise<void>;
}

export async function sumarUso(db: UsoDb, cid: string, doc: string, campo: CampoUso, delta: number): Promise<void> {
  if (delta === 0) return;
  await db.sumar(`companies/${cid}/uso/${doc}`, campo, delta);
}
