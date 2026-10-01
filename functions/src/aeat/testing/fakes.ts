// Dobles en memoria de los puertos para los tests del orquestador y de la cadena.
import { aplicarPatchVerifactu } from '../chain';
import type { HttpRespuesta } from '../parseResponse';
import type { ChainStore, ChainTx, Clock, CredentialReader, Credenciales, SoapSender, VerifactuPatch } from '../ports';
import type { ChainHead, InvoiceDoc } from '../types';

const MAX_REINTENTOS_TX = 10;

interface EstadoEmpresa {
  head: ChainHead | null;
  invoices: Map<string, InvoiceDoc>;
  /** Contador de versión: concurrencia optimista como la de las transacciones de Firestore. */
  version: number;
}

/**
 * ChainStore en memoria con versión y reintento de la transacción. Las escrituras se
 * acumulan en un buffer y solo se aplican si nadie ha confirmado entre medias; si no,
 * se vuelve a ejecutar el callback (igual que Firestore).
 */
export class FakeChainStore implements ChainStore {
  private readonly empresas = new Map<string, EstadoEmpresa>();
  /** Número de veces que una transacción tuvo que reintentarse por conflicto. */
  conflictos = 0;
  /** Se invoca justo antes de confirmar; permite a los tests forzar intercalados. */
  antesDeConfirmar?: () => Promise<void>;

  private empresa(companyId: string): EstadoEmpresa {
    let e = this.empresas.get(companyId);
    if (!e) {
      e = { head: null, invoices: new Map(), version: 0 };
      this.empresas.set(companyId, e);
    }
    return e;
  }

  sembrarFactura(invoice: InvoiceDoc): void {
    this.empresa(invoice.companyId).invoices.set(invoice.id, structuredClone(invoice));
  }

  sembrarHead(companyId: string, head: ChainHead | null): void {
    this.empresa(companyId).head = head ? structuredClone(head) : null;
  }

  head(companyId: string): ChainHead | null {
    const h = this.empresa(companyId).head;
    return h ? structuredClone(h) : null;
  }

  factura(companyId: string, invoiceId: string): InvoiceDoc | undefined {
    const i = this.empresa(companyId).invoices.get(invoiceId);
    return i ? structuredClone(i) : undefined;
  }

  async runTx<T>(companyId: string, fn: (tx: ChainTx) => Promise<T>): Promise<T> {
    const e = this.empresa(companyId);
    for (let intento = 0; intento < MAX_REINTENTOS_TX; intento++) {
      const versionLeida = e.version;
      let headNuevo: ChainHead | undefined;
      const parches: { invoiceId: string; tipo: 'alta' | 'anulacion'; patch: VerifactuPatch }[] = [];

      const tx: ChainTx = {
        getHead: async () => {
          await Promise.resolve(); // punto de cesión: permite intercalar otras transacciones
          const h = headNuevo ?? e.head;
          return h ? structuredClone(h) : null;
        },
        setHead: async (head) => {
          headNuevo = structuredClone(head);
        },
        getInvoice: async (id) => {
          await Promise.resolve();
          const i = e.invoices.get(id);
          return i ? structuredClone(i) : null;
        },
        patchVerifactu: async (invoiceId, tipo, patch) => {
          parches.push({ invoiceId, tipo, patch: structuredClone(patch) });
        },
      };

      const resultado = await fn(tx);
      await this.antesDeConfirmar?.();

      if (e.version !== versionLeida) {
        this.conflictos++;
        continue;
      }
      if (headNuevo) e.head = headNuevo;
      for (const p of parches) {
        const inv = e.invoices.get(p.invoiceId);
        if (inv) inv.verifactu = aplicarPatchVerifactu(inv.verifactu, p.tipo, p.patch);
      }
      e.version++;
      return resultado;
    }
    throw new Error('FakeChainStore: demasiados conflictos de transacción');
  }
}

export interface LlamadaEnvio {
  url: string;
  xml: string;
  creds: Credenciales;
}

/** Sender falso: registra cada envío y responde con la cola de respuestas (o una por defecto). */
export class FakeSender {
  readonly llamadas: LlamadaEnvio[] = [];
  private readonly respuestas: (HttpRespuesta | Error)[] = [];

  constructor(private readonly porDefecto?: HttpRespuesta) {}

  encolar(...respuestas: (HttpRespuesta | Error)[]): void {
    this.respuestas.push(...respuestas);
  }

  readonly enviar: SoapSender = async (url, xml, creds) => {
    this.llamadas.push({ url, xml, creds });
    const siguiente = this.respuestas.shift() ?? this.porDefecto;
    if (!siguiente) throw new Error('FakeSender: sin respuesta configurada');
    if (siguiente instanceof Error) throw siguiente;
    return siguiente;
  };
}

/** Reloj controlable. */
export class FakeClock {
  constructor(private ms: number) {}

  readonly ahora: Clock = () => new Date(this.ms);

  avanzarS(segundos: number): void {
    this.ms += segundos * 1000;
  }
}

export const credencialesFalsas: Credenciales = { certPem: 'CERT', keyPem: 'KEY' };

export const fakeCredentialReader: CredentialReader = async () => credencialesFalsas;
