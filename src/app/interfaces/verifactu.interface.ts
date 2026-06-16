/** Tipos para el Sistema de Información de Facturación (SIF) de la AEAT — Verifactu */

export interface VerifactuIDFactura {
  NIF: string;
  NumSerieFactura: string;
  FechaExpedicionFactura: string; // dd-mm-yyyy
}

export interface VerifactuDesgloseIVA {
  BaseImponibleOImporteNoSujeto: number;
  TipoImpositivo: number; // porcentaje, ej. 21
  CuotaRepercutida: number;
}

/** Registro de alta de factura según spec AEAT Verifactu v1.0 */
export interface VerifactuRegistro {
  IDFactura: VerifactuIDFactura;
  NombreRazonEmisor: string;
  TipoFactura: 'F1' | 'F2' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
  DescripcionOperacion: string;
  /** NIF del destinatario (empresa o persona, si aplica) */
  NIF?: string;
  NombreDestinatario?: string;
  Desglose: VerifactuDesgloseIVA[];
  CuotaTotal: number;
  ImporteTotal: number;
  /** SHA-256 hex del registro anterior de la misma empresa. Vacío en la primera factura. */
  HuellaAnterior: string;
  FechaHoraHusoGenRegistro: string; // ISO-8601 con zona horaria
}

/** Estado de Verifactu almacenado en el documento Invoice de Firestore */
export interface VerifactuEstado {
  estado: 'pendiente' | 'enviado' | 'error' | 'no_aplica';
  /** SHA-256 hex de este registro (para usarse como HuellaAnterior en la siguiente factura) */
  huella?: string;
  huellaAnterior?: string;
  /** Código Seguro de Verificación devuelto por AEAT tras aceptar el registro */
  csv?: string;
  qrUrl?: string;
  enviadoAt?: string;
  error?: string;
}

/** Respuesta de la Cloud Function verifactuSubmit */
export interface VerifactuSubmitResponse {
  csv: string;
  estado: 'aceptado' | 'rechazado';
  rawResponse?: string;
}
