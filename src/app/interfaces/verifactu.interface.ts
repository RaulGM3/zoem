/**
 * Tipos de Verifactu (SIF de la AEAT) en el cliente.
 *
 * El servidor es el único que escribe `invoice.verifactu` (hash, cadena, XML y envío
 * viven en `functions/src/aeat`). Estos tipos ESPEJAN `functions/src/aeat/types.ts`
 * porque `functions` y `src/app` no comparten código (rootDir distinto): si cambia uno,
 * hay que cambiar el otro.
 */

/** Causas de exención (E1..E6) y de no sujeción (N1, N2) del XSD de la AEAT. */
export type CausaExencion = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'N1' | 'N2';

/** Máquina de estados del registro. `no_aplica` solo aparece en facturas antiguas. */
export type EstadoVerifactu = 'en_cola' | 'pendiente' | 'enviado' | 'error' | 'no_aplica';

/** Lo que el cliente puede pedir al callable `verifactuSubmit`. */
export type TipoEnvioVerifactu = 'alta' | 'anulacion';

/** Estado de un registro (alta o anulación) tal y como lo escribe el servidor. */
export interface VerifactuEstado {
  estado: EstadoVerifactu;
  tipoRegistro: TipoEnvioVerifactu;
  huella?: string;
  /** URL de verificación para el QR del PDF; existe desde que se genera el registro. */
  qrUrl?: string;
  /** Código Seguro de Verificación devuelto por la AEAT. */
  csv?: string;
  aceptadoConErrores?: boolean;
  codigoError?: string;
  descripcionError?: string;
  errorKind?: 'precondicion' | 'aeat' | 'configuracion';
  errorMessage?: string;
  /**
   * Motivo por el que un registro `pendiente` no avanza (p. ej. falta el certificado en un
   * reintento automático). No es un error: el servidor sigue reintentando.
   */
  avisoMessage?: string;
  /** Hubo un rechazo previo del mismo registro (el reenvío va como subsanación). */
  rechazoPrevio?: boolean;
  /** Envíos realizados a la AEAT (cuenta envíos, no pulsaciones de reintento). */
  attempts?: number;
  encoladoAt?: string;
  generadoAt?: string;
  enviadoAt?: string;
  /** Misma máquina de estados que el alta, sin tocar sus campos (el QR sobrevive). */
  anulacion?: Omit<VerifactuEstado, 'anulacion' | 'tipoRegistro' | 'qrUrl'>;
  /** Solo en facturas anteriores a la migración al servidor. */
  error?: string;
}

/** Petición del callable `verifactuSubmit`. Reintentar es llamar de nuevo con lo mismo. */
export interface VerifactuSolicitud {
  companyId: string;
  invoiceId: string;
  tipo: TipoEnvioVerifactu;
}

/** Respuesta del callable `verifactuSubmit` (ver `ResultadoEnvio` en functions). */
export type VerifactuSubmitResponse =
  | { sent: false; motivo: 'verifactu_desactivado' }
  | { sent: false; motivo: 'precondicion'; codigo: string; mensaje: string; estado: 'error' }
  | { sent: false; motivo: 'certificado'; mensaje: string; estado: 'error' }
  | { sent: boolean; estado: EstadoVerifactu; mensaje?: string; csv?: string };
