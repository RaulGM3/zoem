// Selección de endpoint SOAP y de URL del QR por entorno. La elección es siempre
// del servidor (flag `verifactu.sandbox` de la empresa); el cliente nunca la aporta.

const SOAP_SANDBOX = 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';
const SOAP_PRODUCCION = 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';

const QR_SANDBOX = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR';
const QR_PRODUCCION = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR';

export function soapEndpoint(sandbox: boolean): string {
  return sandbox ? SOAP_SANDBOX : SOAP_PRODUCCION;
}

export interface DatosQr {
  nif: string;
  numSerie: string;
  /** dd-MM-yyyy */
  fecha: string;
  importe: number | string;
}

export function qrUrl(sandbox: boolean, datos: DatosQr): string {
  const base = sandbox ? QR_SANDBOX : QR_PRODUCCION;
  const importe = Number(datos.importe).toFixed(2);
  const query = [
    `nif=${encodeURIComponent(datos.nif)}`,
    `numserie=${encodeURIComponent(datos.numSerie)}`,
    `fecha=${encodeURIComponent(datos.fecha)}`,
    `importe=${encodeURIComponent(importe)}`,
  ].join('&');
  return `${base}?${query}`;
}
