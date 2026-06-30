import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as forge from 'node-forge';
import * as https from 'https';
import { certSecretName, getSecret } from './secretManager';
import { assertCompanyAccess } from '../lib/assertCompanyAccess';


const AEAT_ENDPOINTS: Record<string, string> = {
  sandbox: 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaVerifactu',
  production: 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaVerifactu',
};

interface VerifactuSubmitRequest {
  companyId: string;
  registro: Record<string, unknown>;
  /** Si true → endpoint sandbox AEAT (prewww1.aeat.es). Por defecto true si no se indica. */
  sandbox?: boolean;
}

interface VerifactuSubmitResponse {
  csv: string;
  estado: 'aceptado' | 'rechazado';
  rawResponse?: string;
}

// Escapa los 5 caracteres especiales de XML para evitar romper el envelope
// o inyectar nodos cuando un campo trae <, >, &, " o '.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
            <sfe:IDEmisorFactura>${escapeXml(IDFactura.NIF)}</sfe:IDEmisorFactura>
            <sfe:NumSerieFactura>${escapeXml(IDFactura.NumSerieFactura)}</sfe:NumSerieFactura>
            <sfe:FechaExpedicionFactura>${escapeXml(IDFactura.FechaExpedicionFactura)}</sfe:FechaExpedicionFactura>
          </sfe:IDFactura>
          <sfe:NombreRazonEmisor>${escapeXml(NombreRazonEmisor)}</sfe:NombreRazonEmisor>
          <sfe:TipoFactura>${escapeXml(TipoFactura)}</sfe:TipoFactura>
          <sfe:DescripcionOperacion>${escapeXml(DescripcionOperacion)}</sfe:DescripcionOperacion>
          <sfe:Desglose>${desgloseXml}</sfe:Desglose>
          <sfe:CuotaTotal>${CuotaTotal.toFixed(2)}</sfe:CuotaTotal>
          <sfe:ImporteTotal>${ImporteTotal.toFixed(2)}</sfe:ImporteTotal>
          <sfe:Huella>${escapeXml(HuellaAnterior)}</sfe:Huella>
          <sfe:FechaHoraHusoGenRegistro>${escapeXml(FechaHoraHusoGenRegistro)}</sfe:FechaHoraHusoGenRegistro>
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

// AEAT devuelve el resultado en <EstadoRegistro> (Correcto / AceptadoConErrores /
// Incorrecto). Parseamos ESE campo y, ante cualquier respuesta no reconocida,
// devolvemos rechazado (fail-safe: nunca asumimos aceptación por defecto).
function isAceptado(xml: string): boolean {
  const estado = xml
    .match(/<[^>]*EstadoRegistro[^>]*>([^<]+)<\/[^>]*EstadoRegistro[^>]*>/i)?.[1]
    ?.trim();
  return estado === 'Correcto' || estado === 'AceptadoConErrores';
}

export const verifactuSubmit = onCall<VerifactuSubmitRequest, Promise<VerifactuSubmitResponse>>(
  { enforceAppCheck: false, timeoutSeconds: 60, invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticación requerida');
    }

    const { companyId, registro, sandbox } = request.data;
    if (!companyId || !registro) {
      throw new HttpsError('invalid-argument', 'Faltan parámetros requeridos');
    }

    // Autorización de tenant: solo Admin/Gestor (o superusuario) de ESTA empresa
    // puede emitir facturas a AEAT con su certificado. Las rules NO aplican acá.
    await assertCompanyAccess(request.auth.uid, companyId);

    // sandbox=true (o undefined → safe default) → endpoint de preproducción AEAT
    const useSandbox = sandbox !== false;
    const endpoint = useSandbox ? AEAT_ENDPOINTS['sandbox']! : AEAT_ENDPOINTS['production']!;
    console.log(`[Verifactu] Enviando a ${useSandbox ? 'SANDBOX' : 'PRODUCCIÓN'}: ${endpoint}`);

    const secretName = certSecretName(companyId);

    console.log(`[Verifactu] Buscando secret: ${secretName}`);
    let pfxBuffer: Buffer;
    let password: string;
    try {
      pfxBuffer = await getSecret(secretName);
      password = (await getSecret(`${secretName}-pwd`)).toString('utf-8');
    } catch (err) {
      console.error(`[Verifactu] Error accediendo Secret Manager (${secretName}):`, err);
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
