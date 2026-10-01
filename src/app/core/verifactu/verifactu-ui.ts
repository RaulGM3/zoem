import type { Invoice } from '../services/invoice.service';
import type {
  EstadoVerifactu,
  TipoEnvioVerifactu,
  VerifactuEstado,
} from '../../interfaces/verifactu.interface';

/** Lo mínimo de una factura que necesita la lógica de Verifactu de la UI. */
export type FacturaVerifactu = Pick<Invoice, 'status' | 'verifactu'>;

type EstadoRegistro = Omit<VerifactuEstado, 'anulacion' | 'tipoRegistro' | 'qrUrl'> & {
  tipoRegistro?: TipoEnvioVerifactu;
};

export type TonoVerifactu = 'success' | 'warning' | 'danger' | 'neutral';

export interface VistaVerifactu {
  estado: EstadoVerifactu;
  tipo: TipoEnvioVerifactu;
  etiqueta: string;
  tono: TonoVerifactu;
  /** Segunda línea: intentos y antigüedad, o el motivo del error. */
  detalle: string | null;
  /** Aviso de AceptadoConErrores (el registro se aceptó, pero con incidencias). */
  aviso: string | null;
  csv: string | null;
  reintentable: boolean;
}

const ESTADOS_REINTENTABLES: readonly EstadoVerifactu[] = ['error', 'pendiente', 'en_cola'];
const ESTADOS_BLOQUEANTES: readonly EstadoVerifactu[] = ['pendiente', 'en_cola', 'enviado'];

/**
 * Una factura con registro vivo (en cola, pendiente o enviado) no se puede editar ni
 * renumerar: el registro ya reservado no debe divergir de la factura. Tras `error` se
 * puede editar de nuevo.
 */
export function verifactuBloqueada(factura: Pick<Invoice, 'verifactu'>): boolean {
  const estado = factura.verifactu?.estado;
  return estado !== undefined && ESTADOS_BLOQUEANTES.includes(estado);
}

export function motivoBloqueoVerifactu(factura: Pick<Invoice, 'verifactu'>): string | null {
  const estado = factura.verifactu?.estado;
  if (estado === 'enviado') return 'La factura ya registrada en Verifactu no se puede modificar';
  if (estado === 'pendiente' || estado === 'en_cola') {
    return 'La factura tiene un registro Verifactu en curso (pendiente de enviar a la AEAT) y no se puede modificar';
  }
  return null;
}

/** Registro efectivo de una factura: la anulación manda cuando la factura está anulada. */
function registroEfectivo(factura: FacturaVerifactu): { registro: EstadoRegistro; tipo: TipoEnvioVerifactu } | null {
  const alta = factura.verifactu;
  if (!alta) return null;
  if (factura.status === 'anulada' && alta.anulacion) {
    return { registro: alta.anulacion, tipo: 'anulacion' };
  }
  return { registro: alta, tipo: 'alta' };
}

/** Qué registro hay que reenviar (R9.3): error, pendiente o en cola; null si no procede. */
export function tipoReintento(factura: FacturaVerifactu): TipoEnvioVerifactu | null {
  const efectivo = registroEfectivo(factura);
  if (!efectivo || !ESTADOS_REINTENTABLES.includes(efectivo.registro.estado)) return null;
  return efectivo.tipo;
}

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

export function formatoAntiguedad(iso: string, ahoraMs: number): string {
  const desde = Date.parse(iso);
  if (Number.isNaN(desde)) return '';
  const ms = Math.max(0, ahoraMs - desde);
  if (ms < MINUTO_MS) return 'hace menos de 1 min';
  if (ms < HORA_MS) return `hace ${Math.floor(ms / MINUTO_MS)} min`;
  if (ms < DIA_MS) return `hace ${Math.floor(ms / HORA_MS)} h`;
  return `hace ${Math.floor(ms / DIA_MS)} d`;
}

function juntar(partes: (string | null | undefined | false)[]): string | null {
  const texto = partes.filter(Boolean).join(' · ');
  return texto || null;
}

function textoCodigoAeat(registro: EstadoRegistro): string | null {
  if (!registro.codigoError) return null;
  return `AEAT ${registro.codigoError}${registro.descripcionError ? `: ${registro.descripcionError}` : ''}`;
}

const MENSAJE_ERROR_GENERICO = 'No se pudo registrar en la AEAT';

export function vistaVerifactu(factura: FacturaVerifactu, ahoraMs: number): VistaVerifactu | null {
  const efectivo = registroEfectivo(factura);
  if (!efectivo) return null;
  const { registro: r, tipo } = efectivo;
  const esBaja = tipo === 'anulacion';
  const base = { estado: r.estado, tipo, aviso: null, csv: null, reintentable: ESTADOS_REINTENTABLES.includes(r.estado) };

  switch (r.estado) {
    case 'en_cola':
      return {
        ...base,
        etiqueta: esBaja ? 'Anulación en cola' : 'En cola',
        tono: 'neutral',
        detalle: juntar(['Esperando al registro anterior', r.encoladoAt && formatoAntiguedad(r.encoladoAt, ahoraMs)]),
      };
    case 'pendiente':
      return {
        ...base,
        etiqueta: esBaja ? 'Anulación pendiente de AEAT' : 'Pendiente de AEAT',
        tono: 'warning',
        detalle: juntar([r.attempts ? `Intento ${r.attempts}` : null, r.generadoAt && formatoAntiguedad(r.generadoAt, ahoraMs)]),
      };
    case 'enviado': {
      const conErrores = r.aceptadoConErrores === true;
      return {
        ...base,
        etiqueta: esBaja ? 'Anulación registrada' : conErrores ? 'Aceptada con errores' : 'Registrada en AEAT',
        tono: conErrores ? 'warning' : 'success',
        detalle: null,
        aviso: conErrores ? (textoCodigoAeat(r) ?? 'La AEAT aceptó el registro con incidencias') : null,
        csv: r.csv ?? null,
      };
    }
    case 'error':
      return {
        ...base,
        etiqueta: esBaja ? 'Error en anulación' : 'Error',
        tono: 'danger',
        detalle: juntar([r.errorMessage, textoCodigoAeat(r)]) ?? r.error ?? MENSAJE_ERROR_GENERICO,
      };
    case 'no_aplica':
      return { ...base, etiqueta: 'No aplica', tono: 'neutral', detalle: null };
  }
}

/** Token CSS del color de texto para cada tono (reutiliza los tokens de styles.css). */
export function colorTono(tono: TonoVerifactu): string {
  switch (tono) {
    case 'success': return 'var(--success)';
    case 'warning': return 'var(--warning)';
    case 'danger': return 'var(--danger)';
    case 'neutral': return 'var(--text-muted)';
  }
}
