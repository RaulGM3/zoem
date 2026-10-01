// Puertos (interfaces) del orquestador Verifactu. Las implementaciones reales
// (Firestore, https, Secret Manager) viven en adapters.ts; los tests usan testing/fakes.ts.
import type { HttpRespuesta } from './parseResponse';
import type { ChainHead, EstadoVerifactu, InvoiceDoc, VerifactuState } from './types';

/**
 * Cambio parcial de `invoice.verifactu`. Siempre lleva `estado` (el alta añade `tipoRegistro`).
 * Para `tipo: 'anulacion'` el adaptador lo aplica dentro de `verifactu.anulacion`
 * (sin `tipoRegistro` ni `qrUrl`). Nunca contiene `undefined` (Firestore lo rechaza).
 */
export type VerifactuPatch = Omit<Partial<VerifactuState>, 'anulacion'> & { estado: EstadoVerifactu };

export interface InvoicePatch {
  invoiceId: string;
  tipo: 'alta' | 'anulacion';
  patch: VerifactuPatch;
}

/** Vista transaccional del estado de una empresa. Sin llamadas de red dentro. */
export interface ChainTx {
  getHead(): Promise<ChainHead | null>;
  setHead(head: ChainHead): Promise<void>;
  getInvoice(invoiceId: string): Promise<InvoiceDoc | null>;
  patchVerifactu(invoiceId: string, tipo: 'alta' | 'anulacion', patch: VerifactuPatch): Promise<void>;
}

export interface ChainStore {
  runTx<T>(companyId: string, fn: (tx: ChainTx) => Promise<T>): Promise<T>;
}

export interface Credenciales {
  certPem: string;
  keyPem: string;
}

/** Envía el XML tal cual; devuelve status+body, lanza si hay timeout/red. */
export type SoapSender = (url: string, xml: string, creds: Credenciales) => Promise<HttpRespuesta>;

export type CredentialReader = (companyId: string) => Promise<Credenciales>;

export type Clock = () => Date;
