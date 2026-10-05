import { Timestamp } from '@angular/fire/firestore';
import type { CausaExencion } from './verifactu.interface';

/** Resultado de la verificación del QR contra la AEAT (ValidarQR). Solo el servidor lo cambia tras la creación. */
export type EstadoQr = 'sin_qr' | 'pendiente' | 'encontrada' | 'no_encontrada' | 'no_verificable' | 'error';

export type EstadoFacturaRecibida = 'registrada' | 'anulada';

export type TrimestreIva = 1 | 2 | 3 | 4;

/** Una línea del desglose de IVA soportado (una por tipo impositivo, como el libro de la AEAT). */
export interface LineaIvaRecibida {
  base: number;
  /** Porcentaje 0–100 con hasta 2 decimales (no se limita a `TipoIva`: pueden llegar facturas al 5 % o 2 %). */
  tipo: number;
  cuota: number;
  exento?: boolean;
  causaExencion?: CausaExencion;
}

export interface PeriodoIva {
  ejercicio: number;
  trimestre: TrimestreIva;
}

/** Registro de una factura recibida (libro registro de facturas recibidas + IVA soportado). Solo F1/F2 con clave 01 en v1. */
export interface FacturaRecibida {
  /** Id determinista: `claveFactura(nif, numero)`. */
  id: string;
  companyId: string;
  /** Número de recepción correlativo por ejercicio (art. 64 RIVA). */
  numeroRecepcion: number;
  tipoFactura: 'F1' | 'F2';
  claveOperacion: '01';
  proveedor: { nombre: string; nif: string; pais?: string };
  numero: string;
  /** Fechas ISO `yyyy-MM-dd`. */
  fechaExpedicion: string;
  fechaOperacion?: string;
  fechaRegistro: string;
  periodo303: PeriodoIva;
  lineasIva: LineaIvaRecibida[];
  total: number;
  /** 0–100, por defecto 100. La prorrata queda fuera de alcance. */
  porcentajeDeducible: number;
  concepto: string;
  categoria?: string;
  adjunto?: { storagePath: string; nombre: string; mimeType: string; size: number };
  qr?: { url: string; nif: string; numserie: string; fecha: string; importe: number };
  /** Top-level a propósito: las rules solo ven `affectedKeys()` de primer nivel. */
  qrValidacion: { estado: EstadoQr; at?: Timestamp; urlConsulta?: string };
  extraccion: { origen: 'ia' | 'qr' | 'manual'; discrepancias: string[] };
  movimientoId?: string;
  casoId?: string;
  estado: EstadoFacturaRecibida;
  /** Historial de anulación: se conserva al reactivar una factura anulada. */
  anuladaPor?: string;
  anuladaAt?: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

/** Contador del número de recepción: `companies/{cid}/facturas_recibidas_meta/{ejercicio}`. */
export interface FacturasRecibidasMeta {
  ultimo: number;
}
