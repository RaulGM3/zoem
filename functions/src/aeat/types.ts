// Tipos compartidos del módulo Verifactu (servidor). Sin dependencias de I/O.
// No se pueden compartir con `src/app` (rootDir de functions), así que se espejan.

/** Causas de exención (E1..E6) y de no sujeción (N1, N2) del XSD de AEAT. */
export type CausaExencion = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'N1' | 'N2';

export type TipoFactura = 'F1' | 'R1';

/** Impuesto AEAT: 01 = IVA, 02 = IPSI, 03 = IGIC. */
export type CodigoImpuesto = '01' | '02' | '03';

export interface InvoiceLineaDoc {
  concepto: string;
  descripcion?: string;
  cantidad: number;
  precioUnitario: number;
  base: number;
  aplicaIva: boolean;
  /** Fracción (0.21), igual que en la app. */
  ivaRate?: number;
  causaExencion?: CausaExencion;
}

export type EstadoVerifactu = 'en_cola' | 'pendiente' | 'enviado' | 'error' | 'no_aplica';

export interface VerifactuState {
  estado: EstadoVerifactu;
  tipoRegistro: 'alta' | 'anulacion';
  huella?: string;
  qrUrl?: string;
  csv?: string;
  aceptadoConErrores?: boolean;
  codigoError?: string;
  descripcionError?: string;
  errorKind?: 'precondicion' | 'aeat' | 'configuracion';
  errorMessage?: string;
  /**
   * Motivo visible de un `pendiente` que no avanza por causa de configuración (p. ej. falta el
   * certificado en un drenaje). NO es un error: el estado sigue `pendiente` y el reintento
   * automático continúa. Se borra con cualquier parche posterior que no lo lleve.
   */
  avisoMessage?: string;
  rechazoPrevio?: boolean;
  attempts?: number;
  encoladoAt?: string;
  generadoAt?: string;
  enviadoAt?: string;
  /** Misma máquina de estados que el alta, sin tocar sus campos (el QR sobrevive). */
  anulacion?: Omit<VerifactuState, 'anulacion' | 'tipoRegistro' | 'qrUrl'>;
}

export interface InvoiceDoc {
  id: string;
  companyId: string;
  invoiceNumber: string;
  total: number;
  /** yyyy-MM-dd */
  issueDate: string;
  clienteNombre?: string;
  clienteNif?: string;
  lineas?: InvoiceLineaDoc[];
  /** Fracción (0.21). */
  ivaRate?: number;
  notes?: string;
  tipoFactura?: TipoFactura;
  facturaRectificadaId?: string;
  verifactu?: VerifactuState;
}

export interface CompanyDoc {
  name: string;
  cif?: string;
  ca: string;
  verifactu?: {
    enabled: boolean;
    /** Ausente en empresas antiguas: se trata como sandbox (ver `esSandbox`). */
    sandbox?: boolean;
    certNif?: string;
  };
}

export interface IdFactura {
  idEmisor: string;
  numSerie: string;
  /** dd-MM-yyyy */
  fecha: string;
}

/** Eslabón de la cadena: identifica un registro generado y su huella. */
export interface ChainLink extends IdFactura {
  huella: string;
  /** ISO 8601 con huso, tal cual se usó en la huella. */
  fechaHoraHuso: string;
}

export interface DetalleDesglose {
  impuesto: CodigoImpuesto;
  claveRegimen: '01';
  /** S1 | N1 | N2 (mutuamente excluyente con operacionExenta). */
  calificacionOperacion?: 'S1' | 'N1' | 'N2';
  /** E1..E6 */
  operacionExenta?: Exclude<CausaExencion, 'N1' | 'N2'>;
  /** Porcentaje con 2 decimales ("21.00"); solo en operaciones sujetas y no exentas. */
  tipoImpositivo?: string;
  baseImponible: string;
  cuotaRepercutida?: string;
}

export interface SistemaInformaticoRegistro {
  nombreRazon: string;
  nif: string;
  nombreSistemaInformatico: string;
  idSistemaInformatico: string;
  version: string;
  numeroInstalacion: string;
  tipoUsoPosibleSoloVerifactu: 'S' | 'N';
  tipoUsoPosibleMultiOT: 'S' | 'N';
  indicadorMultiplesOT: 'S' | 'N';
}

export type Encadenamiento = { primerRegistro: true } | { primerRegistro: false; anterior: ChainLink };

export interface RegistroAlta {
  tipo: 'alta';
  idVersion: string;
  idFactura: IdFactura;
  nombreRazonEmisor: string;
  subsanacion?: 'S';
  rechazoPrevio?: 'X';
  tipoFactura: TipoFactura;
  tipoRectificativa?: 'I';
  facturasRectificadas?: IdFactura[];
  descripcionOperacion: string;
  destinatario?: { nombreRazon: string; nif: string };
  desglose: DetalleDesglose[];
  cuotaTotal: string;
  importeTotal: string;
  encadenamiento: Encadenamiento;
  sistemaInformatico: SistemaInformaticoRegistro;
  fechaHoraHusoGenRegistro: string;
  tipoHuella: '01';
  huella: string;
}

export interface RegistroAnulacion {
  tipo: 'anulacion';
  idVersion: string;
  idFactura: IdFactura;
  rechazoPrevio?: 'S';
  encadenamiento: Encadenamiento;
  sistemaInformatico: SistemaInformaticoRegistro;
  fechaHoraHusoGenRegistro: string;
  tipoHuella: '01';
  huella: string;
}

export type Registro = RegistroAlta | RegistroAnulacion;

export interface PendingRecord {
  invoiceId: string;
  tipo: 'alta' | 'anulacion';
  /** Envelope exacto: el reenvío es idéntico byte a byte. */
  xml: string;
  huella: string;
  link: ChainLink;
  reservedAt: string;
  attempts: number;
  lastAttemptAt: string | null;
  lastError?: string;
}

export interface QueueEntry {
  invoiceId: string;
  tipo: 'alta' | 'anulacion';
  encoladoAt: string;
}

/** companies/{cid}/verifactuChain/head */
export interface ChainHead {
  /** Último registro GENERADO (aceptado, rechazado o pendiente); null -> PrimerRegistro. */
  last: ChainLink | null;
  pending: PendingRecord | null;
  queue: QueueEntry[];
  nextSendAt: string | null;
  drainAt: string | null;
}
