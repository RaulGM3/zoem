import type { EstadoQr, FacturaRecibida, QrValidacion } from '../../interfaces/factura-recibida.interface';

export type TonoQr = 'neutro' | 'success' | 'warning' | 'danger';

export interface VistaQrValidacion {
  estado: Exclude<EstadoQr, 'sin_qr'>;
  /** Texto visible: el estado nunca depende solo del color. */
  etiqueta: string;
  tono: TonoQr;
  detalle?: string;
  urlConsulta?: string;
}

const ETIQUETAS: Record<Exclude<EstadoQr, 'sin_qr'>, { etiqueta: string; tono: TonoQr }> = {
  pendiente: { etiqueta: 'QR pendiente de validar', tono: 'neutro' },
  encontrada: { etiqueta: 'QR validado en la AEAT', tono: 'success' },
  no_encontrada: { etiqueta: 'QR no encontrado en la AEAT', tono: 'warning' },
  no_verificable: { etiqueta: 'QR no verificable', tono: 'warning' },
  error: { etiqueta: 'Error al validar el QR', tono: 'danger' },
};

/** Insignia de estado del QR para la lista; `null` si la factura no tiene QR (no se muestra nada). */
export function vistaQrValidacion(v: Pick<QrValidacion, 'estado' | 'mensaje' | 'urlConsulta'>): VistaQrValidacion | null {
  if (v.estado === 'sin_qr') return null;
  return {
    estado: v.estado,
    ...ETIQUETAS[v.estado],
    ...(v.estado === 'error' && v.mensaje ? { detalle: v.mensaje } : {}),
    ...(v.urlConsulta ? { urlConsulta: v.urlConsulta } : {}),
  };
}

/** "Validar en AEAT" solo tiene sentido en facturas registradas con QR todavía sin resultado o con error. */
export function puedeValidarQr(f: Pick<FacturaRecibida, 'estado' | 'qr' | 'qrValidacion'>): boolean {
  return (
    f.estado === 'registrada' && !!f.qr && (f.qrValidacion.estado === 'pendiente' || f.qrValidacion.estado === 'error')
  );
}

const MENSAJE_GENERICO = 'No se pudo validar el QR en la AEAT. Inténtalo de nuevo más tarde o verifica la factura manualmente.';

/** Códigos de `HttpsError` del callable (`functions/...`) a mensajes en español. */
export function mensajeErrorValidarQr(err: unknown): string {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  switch (code) {
    case 'functions/permission-denied':
      return 'No tienes permiso para validar facturas de esta empresa.';
    case 'functions/unauthenticated':
      return 'Tu sesión ha caducado. Vuelve a iniciar sesión e inténtalo de nuevo.';
    case 'functions/not-found':
      return 'La factura ya no existe en esta empresa.';
    case 'functions/failed-precondition':
      return 'El QR de esta factura no es válido para consultar en la AEAT.';
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return 'Sin conexión con el servidor. Inténtalo de nuevo en unos minutos.';
    default:
      return MENSAJE_GENERICO;
  }
}

/** Texto para la región `aria-live` tras una validación; `null` si no hay nada que anunciar. */
export function anuncioValidacionQr(
  referencia: string,
  v: Pick<QrValidacion, 'estado' | 'mensaje'>,
): string | null {
  const vista = vistaQrValidacion(v);
  if (!vista) return null;
  return `${referencia}: ${vista.etiqueta}${vista.detalle ? `. ${vista.detalle}` : ''}`;
}
