/**
 * Lógica PURA de la red de seguridad de cuota de almacenamiento (la usa el trigger de Storage
 * `limitarCuotaArchivos`). La barrera principal son las Storage rules; esto cubre carreras entre subidas
 * simultáneas (el contador es eventualmente consistente) y cualquier subida que se salte las rules.
 */

export type RutaArchivo =
  | { tipo: 'caso'; cid: string; casoId: string }
  | { tipo: 'contacto'; cid: string; contactId: string };

const RE_CASO = /^companies\/([^/]+)\/casos\/([^/]+)\/docs\/.+/;
const RE_CONTACTO = /^companies\/([^/]+)\/contacts\/([^/]+)\/.+/;

/** Solo estas rutas cuentan en `uso/total.documentosBytes` (doc_files y contact_files). Misma lista que storage.rules. */
export function parseRutaArchivo(nombre: string): RutaArchivo | null {
  const caso = RE_CASO.exec(nombre);
  if (caso) return { tipo: 'caso', cid: caso[1], casoId: caso[2] };
  const contacto = RE_CONTACTO.exec(nombre);
  if (contacto) return { tipo: 'contacto', cid: contacto[1], contactId: contacto[2] };
  return null;
}

export type DecisionCuota =
  | { accion: 'conservar' }
  | { accion: 'eliminar'; usadoBytes: number; limiteBytes: number };

/**
 * `contado`: ya existe un doc de metadatos que referencia el objeto (y por tanto su tamaño está o va a
 * estar en el contador). Si no, se suma `tamano` al uso para saber si cabe.
 * `limiteMB: null` = ilimitado.
 */
export function decidirCuotaArchivo(p: { usadoBytes: number; tamano: number; contado: boolean; limiteMB: number | null }): DecisionCuota {
  if (p.limiteMB === null) return { accion: 'conservar' };
  const limiteBytes = p.limiteMB * 1_048_576;
  const total = p.usadoBytes + (p.contado ? 0 : p.tamano);
  return total > limiteBytes ? { accion: 'eliminar', usadoBytes: total, limiteBytes } : { accion: 'conservar' };
}
