// Adaptadores de I/O de Verifactu: Firestore (Admin SDK), https con mTLS y Secret Manager.
// Sin tests unitarios (excepción TDD documentada, task 4.1): se verifican con tsc y revisión.
// Nunca se loguea material del certificado ni contraseñas.
import * as admin from 'firebase-admin';
import * as forge from 'node-forge';
import * as https from 'https';
import { aplicarPatchVerifactu } from './chain';
import { HTTP_TIMEOUT_MS } from './config';
import { ErrorCredenciales } from './credenciales';
import type { HttpRespuesta } from './parseResponse';
import type { ChainStore, ChainTx, Credenciales, CredentialReader, DocReader, SoapSender, VerifactuPatch } from './ports';
import { certSecretName, getSecret } from './secretManager';
import type { EnvioDeps } from './submit';
import type { ChainHead, CompanyDoc, InvoiceDoc } from './types';

/** Firestore rechaza `undefined`; los datos son planos, así que un round-trip JSON los limpia. */
function sinUndefined<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

const headRef = (companyId: string) => admin.firestore().doc(`companies/${companyId}/verifactuChain/head`);
const invoiceRef = (invoiceId: string) => admin.firestore().doc(`invoices/${invoiceId}`);

function leerFactura(id: string, data: admin.firestore.DocumentData | undefined, companyId: string): InvoiceDoc | null {
  if (!data || data['companyId'] !== companyId) return null; // factura de otra empresa == inexistente
  return { ...(data as Omit<InvoiceDoc, 'id'>), id };
}

/**
 * ChainStore sobre transacciones de Firestore. Las escrituras se acumulan y se vuelcan al
 * final del callback: Firestore exige TODAS las lecturas antes que las escrituras, y
 * `patchVerifactu` necesita leer la factura (read-modify-write con `aplicarPatchVerifactu`).
 */
export const firestoreChainStore: ChainStore = {
  runTx(companyId, fn) {
    const db = admin.firestore();
    return db.runTransaction(async (t) => {
      // Estado por intento: si la transacción se reintenta, el callback arranca limpio.
      const facturas = new Map<string, InvoiceDoc | null>();
      const sucias = new Set<string>();
      let headNuevo: ChainHead | undefined;

      const cargar = async (invoiceId: string): Promise<InvoiceDoc | null> => {
        if (!facturas.has(invoiceId)) {
          const snap = await t.get(invoiceRef(invoiceId));
          facturas.set(invoiceId, snap.exists ? leerFactura(snap.id, snap.data(), companyId) : null);
        }
        return facturas.get(invoiceId) ?? null;
      };

      const tx: ChainTx = {
        async getHead() {
          const snap = await t.get(headRef(companyId));
          return snap.exists ? (snap.data() as ChainHead) : null;
        },
        async setHead(head) {
          headNuevo = head;
        },
        getInvoice: cargar,
        async patchVerifactu(invoiceId: string, tipo: 'alta' | 'anulacion', patch: VerifactuPatch) {
          const factura = await cargar(invoiceId);
          if (!factura) return;
          factura.verifactu = aplicarPatchVerifactu(factura.verifactu, tipo, patch);
          sucias.add(invoiceId);
        },
      };

      const resultado = await fn(tx);

      if (headNuevo) t.set(headRef(companyId), sinUndefined(headNuevo));
      for (const id of sucias) {
        const verifactu = facturas.get(id)?.verifactu;
        if (verifactu) t.update(invoiceRef(id), { verifactu: sinUndefined(verifactu) });
      }
      return resultado;
    });
  },
};

export const firestoreDocReader: DocReader = {
  async getCompany(companyId) {
    const snap = await admin.firestore().doc(`companies/${companyId}`).get();
    return snap.exists ? (snap.data() as CompanyDoc) : null;
  },
  async getInvoice(companyId, invoiceId) {
    const snap = await invoiceRef(invoiceId).get();
    return snap.exists ? leerFactura(snap.id, snap.data(), companyId) : null;
  },
};

/** Lee el .p12 y su contraseña de Secret Manager y los convierte a PEM para mTLS. */
export const leerCredenciales: CredentialReader = async (companyId): Promise<Credenciales> => {
  const secretName = certSecretName(companyId);
  const pfx = await getSecret(secretName);
  const password = (await getSecret(`${secretName}-pwd`)).toString('utf-8');

  // Cualquier fallo al abrir el PKCS#12 (DER roto, contraseña errónea, sin cert/clave) es del certificado, no del sistema.
  let cert: forge.pki.Certificate | undefined;
  let key: forge.pki.PrivateKey | undefined;
  try {
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfx.toString('binary')), password);
    cert = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0]?.cert;
    key = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
  } catch (err) {
    throw new ErrorCredenciales('certificado_invalido', `No se pudo abrir el PKCS#12: ${err instanceof Error ? err.message : 'error desconocido'}`);
  }
  if (!cert || !key) {
    console.error('[Verifactu:debug] leerCredenciales -> el PKCS#12 no trae cert o clave', { secretName, hayCert: !!cert, hayClave: !!key });
    throw new ErrorCredenciales('certificado_invalido', 'El PKCS#12 no contiene certificado o clave privada');
  }
  // Solo metadatos públicos del certificado: nunca la clave ni la contraseña.
  const ahora = new Date();
  console.log('[Verifactu:debug] leerCredenciales -> certificado', {
    secretName,
    subject: cert.subject.attributes.map((a) => `${a.shortName ?? a.name}=${String(a.value)}`).join(', '),
    issuer: cert.issuer.attributes.map((a) => `${a.shortName ?? a.name}=${String(a.value)}`).join(', '),
    notBefore: cert.validity.notBefore.toISOString(),
    notAfter: cert.validity.notAfter.toISOString(),
    vigente: ahora >= cert.validity.notBefore && ahora <= cert.validity.notAfter,
  });
  return { certPem: forge.pki.certificateToPem(cert), keyPem: forge.pki.privateKeyToPem(key) };
};

/**
 * POST SOAP con mTLS. Devuelve status + body TAL CUAL (un SOAP Fault llega con HTTP 500 y
 * lo decide parseRespuesta). Lanza ante error de red o timeout de socket (30 s).
 */
export const enviarSoap: SoapSender = (endpoint, xml, creds) =>
  new Promise<HttpRespuesta>((resolve, reject) => {
    const url = new URL(endpoint);
    const cuerpo = Buffer.from(xml, 'utf-8');
    console.log('[Verifactu:debug] enviarSoap -> POST', { endpoint, bytes: cuerpo.byteLength });
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        cert: creds.certPem,
        key: creds.keyPem,
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          SOAPAction: '""',
          'Content-Length': cuerpo.byteLength,
        },
      },
      (res) => {
        const trozos: Buffer[] = [];
        res.on('data', (c: Buffer) => trozos.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(trozos).toString('utf-8') }));
        res.on('error', reject);
      },
    );
    req.setTimeout(HTTP_TIMEOUT_MS, () => {
      console.error('[Verifactu:debug] enviarSoap -> TIMEOUT', { endpoint, ms: HTTP_TIMEOUT_MS });
      req.destroy(new Error(`Timeout de ${HTTP_TIMEOUT_MS} ms hablando con AEAT`));
    });
    req.on('error', (err: NodeJS.ErrnoException) => {
      // Aquí caen los fallos de mTLS (cert rechazado, handshake), DNS y conexión.
      console.error('[Verifactu:debug] enviarSoap -> error de red/TLS', { endpoint, code: err.code, message: err.message });
      reject(err);
    });
    req.write(cuerpo);
    req.end();
  });

export function crearDeps(): EnvioDeps {
  return {
    store: firestoreChainStore,
    docs: firestoreDocReader,
    sender: enviarSoap,
    credentials: leerCredenciales,
    clock: () => new Date(),
  };
}
