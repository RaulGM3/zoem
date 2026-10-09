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

import { periodoMensual } from './periodo';

/**
 * `archivo` = doc_files, contact_files y doc_slots (todas sus versiones); `factura` = adjunto de una factura
 * recibida; `docTemplate` = archivo fuente de una plantilla de documento. Los tres suman a `documentosBytes`.
 */
export type TipoUso = 'caso' | 'contacto' | 'plantilla' | 'miembro' | 'archivo' | 'accion' | 'factura' | 'docTemplate';
export type CampoUso = 'casosActivos' | 'contactos' | 'plantillas' | 'usuarios' | 'documentosBytes' | 'accionesMes' | 'iaMensajesMes';
type Datos = Record<string, unknown> | undefined;

export const CAMPO_DE: Record<TipoUso, CampoUso> = {
  caso: 'casosActivos', contacto: 'contactos', plantilla: 'plantillas', miembro: 'usuarios', archivo: 'documentosBytes', accion: 'accionesMes',
  factura: 'documentosBytes', docTemplate: 'documentosBytes',
};

const ESTADOS_CASO_ACTIVO = new Set(['pendiente', 'en_proceso', 'urgente']);

/**
 * Doc de `uso/` donde cuenta un tipo: `total` o, para los mensuales, `yyyy-mm` del mes en la zona
 * de la empresa (mismo valor que `derechos.periodoUso.clave`, que es lo que leen las rules).
 */
export function docUsoDe(tipo: TipoUso, cuando: Date, zona: string): string {
  return tipo === 'accion' ? periodoMensual(cuando, zona).clave : 'total';
}

const bytesValidos = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Bytes que ocupa un doc de archivo en Storage: TODAS sus versiones (resubir no borra el blob anterior) más el
 * blob actual de primer nivel si no está ya en `versions` (slots generados desde plantilla, docs legados).
 * Se deduplica por `storagePath`. Un doc borrado (soft delete) o un slot retirado ("pendiente") libera su
 * espacio en el cupo: es la forma en que la persona recupera espacio. Los blobs NO se tocan nunca.
 */
export function bytesArchivo(d: Record<string, unknown>): number {
  if (d['deleted'] === true || d['status'] === 'pendiente') return 0;
  const porRuta = new Map<string, number>();
  let sinRuta = 0;
  const sumar = (ruta: unknown, size: unknown) => {
    if (typeof ruta === 'string' && ruta) {
      if (!porRuta.has(ruta)) porRuta.set(ruta, bytesValidos(size));
    } else sinRuta += bytesValidos(size);
  };
  const versiones = Array.isArray(d['versions']) ? (d['versions'] as Record<string, unknown>[]) : [];
  for (const v of versiones) sumar(v?.['storagePath'], v?.['sizeBytes']);
  sumar(d['storagePath'], d['sizeBytes']);
  // Legado sin versions ni ruta: solo el tamaño de primer nivel (ya sumado en `sinRuta`).
  return [...porRuta.values()].reduce((a, b) => a + b, sinRuta);
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
    case 'archivo': return bytesArchivo(d);
    case 'factura': return bytesValidos((d['adjunto'] as Record<string, unknown> | undefined)?.['size']);
    case 'docTemplate': return d['deleted'] === true ? 0 : bytesValidos(d['sourceSizeBytes']);
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
