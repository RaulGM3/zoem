import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import * as forge from 'node-forge';
import * as https from 'https';
import { certSecretName, getSecret } from './secretManager';

const verifactuEnv = defineString('VERIFACTU_ENV', { default: 'sandbox' });

const AEAT_ENDPOINTS: Record<string, string> = {
  sandbox: 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaVerifactu',
  production: 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaVerifactu',
};

interface VerifactuSubmitRequest {
  companyId: string;
  registro: Record<string, unknown>;
}

interface VerifactuSubmitResponse {
  csv: string;
  estado: 'aceptado' | 'rechazado';
  rawResponse?: string;
}

function buildSoapEnvelope(registro: Record<string, unknown>): string {
  const { IDFactura, NombreRazonEmisor, TipoFactura, DescripcionOperacion, Desglose, CuotaTotal, ImporteTotal, HuellaAnterior, FechaHoraHusoGenRegistro } = registro as {
    IDFactura: { NIF: string; NumSerieFactura: string; FechaExpedicionFactura: string };
    NombreRazonEmisor: string;
    TipoFactura: string;
    DescripcionOperacion: string;
    Desglose: Array<{ BaseImponibleOImporteNoSujeto: number; TipoImpositivo: number; CuotaRepercutida: number }>;
    CuotaTotal: number;
    ImporteTotal: number;
    HuellaAnterior: string;
    FechaHoraHusoGenRegistro: string;
  };

  const desgloseXml = Desglose.map(
    (d) => `
      <sfe:DetalleIVA>
        <sfe:BaseImponibleOImporteNoSujeto>${d.BaseImponibleOImporteNoSujeto.toFixed(2)}</sfe:BaseImponibleOImporteNoSujeto>
        <sfe:TipoImpositivo>${d.TipoImpositivo}</sfe:TipoImpositivo>
        <sfe:CuotaRepercutida>${d.CuotaRepercutida.toFixed(2)}</sfe:CuotaRepercutida>
      </sfe:DetalleIVA>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:sfe="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV/cont/ws/SistemaVerifactu.xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <sfe:RegFactuSistemaFacturacion>
      <sfe:Cabecera>
        <sfe:IDVersion>1.0</sfe:IDVersion>
      </sfe:Cabecera>
      <sfe:RegistroFactura>
        <sfe:RegistroAlta>
          <sfe:IDFactura>
            <sfe:IDEmisorFactura>${IDFactura.NIF}</sfe:IDEmisorFactura>
            <sfe:NumSerieFactura>${IDFactura.NumSerieFactura}</sfe:NumSerieFactura>
            <sfe:FechaExpedicionFactura>${IDFactura.FechaExpedicionFactura}</sfe:FechaExpedicionFactura>
          </sfe:IDFactura>
          <sfe:NombreRazonEmisor>${NombreRazonEmisor}</sfe:NombreRazonEmisor>
          <sfe:TipoFactura>${TipoFactura}</sfe:TipoFactura>
          <sfe:DescripcionOperacion>${DescripcionOperacion}</sfe:DescripcionOperacion>
          <sfe:Desglose>${desgloseXml}</sfe:Desglose>
          <sfe:CuotaTotal>${CuotaTotal.toFixed(2)}</sfe:CuotaTotal>
          <sfe:ImporteTotal>${ImporteTotal.toFixed(2)}</sfe:ImporteTotal>
          <sfe:Huella>${HuellaAnterior}</sfe:Huella>
          <sfe:FechaHoraHusoGenRegistro>${FechaHoraHusoGenRegistro}</sfe:FechaHoraHusoGenRegistro>
        </sfe:RegistroAlta>
      </sfe:RegistroFactura>
    </sfe:RegFactuSistemaFacturacion>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function sendSoap(
  endpoint: string,
  soapBody: string,
  cert: forge.pki.Certificate,
  privateKey: forge.pki.PrivateKey,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(privateKey);
    const url = new URL(endpoint);
    const bodyBuffer = Buffer.from(soapBody, 'utf-8');

    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      cert: certPem,
      key: keyPem,
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '""',
        'Content-Length': bodyBuffer.byteLength,
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });

    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

function extractCsvFromResponse(xml: string): string | null {
  const match = xml.match(/<[^>]*CSV[^>]*>([^<]+)<\/[^>]*CSV[^>]*>/i);
  return match?.[1] ?? null;
}

function isAceptado(xml: string): boolean {
  return xml.includes('Correcto') || xml.includes('Aceptado') || !xml.includes('Rechazado');
}

export const verifactuSubmit = onCall<VerifactuSubmitRequest, Promise<VerifactuSubmitResponse>>(
  { enforceAppCheck: false, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticación requerida');
    }

    const { companyId, registro } = request.data;
    if (!companyId || !registro) {
      throw new HttpsError('invalid-argument', 'Faltan parámetros requeridos');
    }

    const secretName = certSecretName(companyId);

    let pfxBuffer: Buffer;
    let password: string;
    try {
      pfxBuffer = await getSecret(secretName);
      password = (await getSecret(`${secretName}-pwd`)).toString('utf-8');
    } catch {
      throw new HttpsError('not-found', 'Certificado AEAT no configurado para esta empresa');
    }

    let cert: forge.pki.Certificate;
    let privateKey: forge.pki.PrivateKey;
    try {
      const pfxDer = pfxBuffer.toString('binary');
      const p12Asn1 = forge.asn1.fromDer(pfxDer);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      cert = certBags[forge.pki.oids.certBag]![0]!.cert!;

      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
      if (!keyBag?.key) throw new Error('Clave privada no encontrada');
      privateKey = keyBag.key as forge.pki.PrivateKey;
    } catch (err) {
      throw new HttpsError('internal', `Error al leer el certificado: ${(err as Error).message}`);
    }

    const soapBody = buildSoapEnvelope(registro);
    const endpoint = AEAT_ENDPOINTS[verifactuEnv.value()] ?? AEAT_ENDPOINTS['sandbox']!;

    let rawResponse: string;
    try {
      rawResponse = await sendSoap(endpoint, soapBody, cert, privateKey);
    } catch (err) {
      throw new HttpsError('internal', `Error de comunicación con AEAT: ${(err as Error).message}`);
    }

    const csv = extractCsvFromResponse(rawResponse) ?? '';
    const estado = isAceptado(rawResponse) ? 'aceptado' : 'rechazado';

    return { csv, estado, rawResponse };
  }
);
