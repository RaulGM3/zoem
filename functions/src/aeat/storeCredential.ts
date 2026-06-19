import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as forge from 'node-forge';
import { certSecretName, storeSecret } from './secretManager';

interface StoreCredentialRequest {
  companyId: string;
  pfxBase64: string;
  password: string;
}

interface StoreCredentialResponse {
  certNif: string;
  certTitular: string;
  certExpiry: string; // ISO date
}

export const storeAeatCredential = onCall<StoreCredentialRequest, Promise<StoreCredentialResponse>>(
  { enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticación requerida');
    }

    const { companyId, pfxBase64, password } = request.data;

    if (!companyId || !pfxBase64 || !password) {
      throw new HttpsError('invalid-argument', 'Faltan parámetros requeridos');
    }

    let p12Asn1: forge.asn1.Asn1;
    try {
      const pfxDer = forge.util.decode64(pfxBase64);
      p12Asn1 = forge.asn1.fromDer(pfxDer);
    } catch {
      throw new HttpsError('invalid-argument', 'El archivo no es un .pfx/.p12 válido');
    }

    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    } catch {
      throw new HttpsError('invalid-argument', 'Contraseña incorrecta o certificado corrupto');
    }

    // Extraer el certificado X.509
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag]?.[0];
    if (!certBag?.cert) {
      throw new HttpsError('invalid-argument', 'No se encontró certificado en el .pfx');
    }

    const cert = certBag.cert;
    const subject = cert.subject;

    const getAttr = (name: string): string =>
      subject.getField(name)?.value ?? '';

    // El NIF suele estar en el CN o en el campo serialNumber del subject
    const cn = getAttr('CN');
    const serialNumber = getAttr('serialNumber');
    // Intentamos extraer NIF del CN (formato habitual AEAT: "APELLIDOS NOMBRE - NIFXXXXX")
    const nifMatch = cn.match(/[A-Z0-9]{9}$/i) ?? serialNumber.match(/[A-Z0-9]{9}$/i);
    const certNif = nifMatch?.[0]?.toUpperCase() ?? cn;
    const certTitular = getAttr('O') || cn;
    const certExpiry = new Date(cert.validity.notAfter).toISOString().slice(0, 10);

    // Almacenar el PFX cifrado en Secret Manager
    const pfxBuffer = Buffer.from(pfxBase64, 'base64');
    const secretName = certSecretName(companyId);
    await storeSecret(secretName, pfxBuffer);

    // Almacenar la contraseña como secret separado
    await storeSecret(`${secretName}-pwd`, Buffer.from(password, 'utf-8'));

    return { certNif, certTitular, certExpiry };
  }
);
