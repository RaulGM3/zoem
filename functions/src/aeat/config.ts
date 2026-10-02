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
 * Datos del sistema informático (productor) que AEAT exige en cada registro. Deben
 * coincidir con la declaración responsable del SIF. AEAT valida el NIF del productor:
 * uno inventado se rechaza con 4109 (comprobado en el sandbox el 2026-10-02).
 */
export const SISTEMA_INFORMATICO: Omit<SistemaInformaticoRegistro, 'numeroInstalacion'> = {
  // Nombre tal como figura en el censo de la AEAT (titular del certificado).
  nombreRazon: 'DE FRUTOS DE FRUTOS VICTOR',
  nif: '47287107G',
  nombreSistemaInformatico: 'Zoem',
  idSistemaInformatico: 'ZM', // 2 caracteres A-Z/0-9 que identifican el producto
  version: SIF_VERSION,
  tipoUsoPosibleSoloVerifactu: 'S',
  tipoUsoPosibleMultiOT: 'S',
  indicadorMultiplesOT: 'N', // una instalación por empresa
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

const CUENTA_SERVICIO = 'verifactu-sender';

/**
 * Email de la cuenta dedicada con la que corren las funciones que leen el certificado AEAT.
 * Va completo porque firebase-tools solo expande la forma corta `nombre@` para la función,
 * no para el job de Cloud Scheduler (deploy de verifactuDrain → 400 "invalid argument").
 * Al desplegar, firebase-tools define GCLOUD_PROJECT con el proyecto destino.
 */
export function cuentaServicioVerifactu(proyecto: string | undefined = process.env['GCLOUD_PROJECT']): string {
  return proyecto ? `${CUENTA_SERVICIO}@${proyecto}.iam.gserviceaccount.com` : `${CUENTA_SERVICIO}@`;
}
