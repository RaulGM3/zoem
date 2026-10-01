import type { CodigoImpuesto, SistemaInformaticoRegistro } from './types';

/** Versión del esquema de registro (IDVersion). */
export const ID_VERSION = '1.0';

/** Versión del SIF (functions/package.json no tiene campo version). */
export const SIF_VERSION = '1.0.0';

/** Espera inicial entre envíos (TiempoEsperaEnvio); cada respuesta de AEAT la actualiza. */
export const DEFAULT_ESPERA_S = 60;

/** Timeout de socket de la petición SOAP. */
export const HTTP_TIMEOUT_MS = 30000;

/** Techo del backoff exponencial de reenvíos (1 h). */
export const MAX_BACKOFF_S = 3600;

/**
 * Datos del sistema informático (productor) que AEAT exige en cada registro.
 * PROVISIONAL: el usuario debe aportar los valores reales antes de producción
 * (task 9.13). Mientras tanto son marcadores, no hechos de AEAT.
 */
export const SISTEMA_INFORMATICO: Omit<SistemaInformaticoRegistro, 'numeroInstalacion'> = {
  nombreRazon: 'Zoem (PROVISIONAL)', // PROVISIONAL: razón social real del productor
  nif: 'B00000000', // PROVISIONAL: NIF real del productor (probe 9.7: puede requerir el NIF de la empresa)
  nombreSistemaInformatico: 'Zoem',
  idSistemaInformatico: 'ZM', // PROVISIONAL: 2 caracteres A-Z/0-9 mandatorios
  version: SIF_VERSION,
  tipoUsoPosibleSoloVerifactu: 'S',
  tipoUsoPosibleMultiOT: 'S',
  indicadorMultiplesOT: 'N', // PROVISIONAL: una instalación por empresa
};

/** Identificador de instalación determinista por empresa (máx. 100 caracteres). */
export function numeroInstalacion(companyId: string): string {
  return `ZOEM-${companyId}`.slice(0, 100);
}

export type ResultadoImpuesto = { ok: true; impuesto: CodigoImpuesto } | { ok: false; motivo: string };

/**
 * Impuesto AEAT según la comunidad autónoma de la empresa. Único punto de decisión:
 * Canarias (IGIC, 03) y Ceuta/Melilla (IPSI, 02) aún no están soportados.
 */
export function impuestoDeEmpresa(ca: string): ResultadoImpuesto {
  if (ca === 'canarias') {
    return { ok: false, motivo: 'IGIC (Canarias) todavía no está soportado en Verifactu' };
  }
  if (ca === 'ceuta' || ca === 'melilla') {
    return { ok: false, motivo: 'IPSI (Ceuta y Melilla) todavía no está soportado en Verifactu' };
  }
  return { ok: true, impuesto: '01' };
}
