import { Timestamp } from '@angular/fire/firestore';

/** Estado de conciliación de una línea del extracto bancario. */
export type EstadoLinea = 'pendiente' | 'casado' | 'ignorado';

/**
 * Línea de un extracto bancario importado. Vive en
 * `companies/{companyId}/cuentas/{cuentaId}/extracto/{lineaId}`.
 *
 * `importe` es CON SIGNO: positivo = abono (entrada), negativo = cargo (salida).
 * Es la fuente real del saldo de la cuenta, frente al `saldoBancario` tecleado a mano.
 */
export interface LineaExtracto {
  id: string;
  cuentaId: string;
  companyId: string;
  fecha: string;
  concepto: string;
  importe: number;
  saldoPosterior?: number;
  estado: EstadoLinea;
  /** Movimiento de gestoría con el que se casó la línea (si `estado === 'casado'`). */
  movimientoId?: string;
  importadoPor: string;
  importadoAt: Timestamp;
}

/** Línea recién parseada de un CSV, antes de persistir (sin metadatos de Firestore). */
export interface LineaExtractoParseada {
  fecha: string;
  concepto: string;
  importe: number;
  saldoPosterior?: number;
}
