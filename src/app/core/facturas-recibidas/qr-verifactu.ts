/**
 * Lectura y contraste puros del QR de una factura Verifactu recibida. Sin dependencias de framework.
 *
 * Solo se aceptan URLs de la AEAT (ValidarQR / ValidarQRNoVerifactu, producción y pruebas). Es la lista de
 * `functions/src/aeat/endpoints.ts` duplicada a propósito (functions no puede importarse desde `src/app`):
 * mantener ambas sincronizadas. La URL devuelta se RECONSTRUYE desde los parámetros ya validados; nunca se
 * reutiliza el texto del QR, así que nada que no sea un valor validado llega a la consulta posterior.
 */

import { normalizarNif } from '../fiscal/nif';
import { esFechaIso } from './trimestre';

/** host => entorno de pruebas. */
const HOSTS_AEAT: Readonly<Record<string, boolean>> = {
  'prewww2.aeat.es': true,
  'www2.agenciatributaria.gob.es': false,
};
const RUTA_VERIFACTU = '/wlpl/TIKE-CONT/ValidarQR';
const RUTA_NO_VERIFACTU = '/wlpl/TIKE-CONT/ValidarQRNoVerifactu';

const RE_FECHA_QR = /^(\d{2})-(\d{2})-(\d{4})$/;
const RE_IMPORTE = /^\d+(\.\d{1,2})?$/;
const MAX_NUMSERIE = 60;

export interface DatosQrFactura {
  nif: string;
  numserie: string;
  /** `yyyy-MM-dd`. */
  fechaIso: string;
  importe: number;
}

export interface QrVerifactu extends DatosQrFactura {
  /** URL canónica reconstruida (la que se guarda y se consulta). */
  url: string;
  /** `dd-MM-yyyy`, tal cual viaja en el QR. */
  fecha: string;
  noVerifactu: boolean;
  sandbox: boolean;
}

export type ResultadoParseQr = { ok: true; datos: QrVerifactu } | { ok: false; motivo: string };

const invalido = (motivo: string): ResultadoParseQr => ({ ok: false, motivo });

export function parseQrVerifactu(texto: string): ResultadoParseQr {
  let url: URL;
  try {
    url = new URL(texto.trim());
  } catch {
    return invalido('No es una URL.');
  }
  if (url.protocol !== 'https:') return invalido('El QR debe usar https.');
  if (url.username || url.password || url.port) return invalido('La URL del QR no es de la AEAT.');
  if (!Object.hasOwn(HOSTS_AEAT, url.hostname)) return invalido('El QR no apunta a la AEAT.');
  const sandbox = HOSTS_AEAT[url.hostname];
  const noVerifactu = url.pathname === RUTA_NO_VERIFACTU;
  if (!noVerifactu && url.pathname !== RUTA_VERIFACTU) return invalido('La ruta del QR no es de validación de la AEAT.');

  const params = url.searchParams;
  for (const clave of ['nif', 'numserie', 'fecha', 'importe']) {
    if (params.getAll(clave).length !== 1) return invalido(`Falta el parámetro «${clave}» o está repetido.`);
  }
  const nif = (params.get('nif') ?? '').trim();
  const numserie = params.get('numserie') ?? '';
  const fecha = params.get('fecha') ?? '';
  const importeTxt = params.get('importe') ?? '';

  if (!nif) return invalido('El NIF del QR está vacío.');
  if (!numserie.trim() || numserie.length > MAX_NUMSERIE) return invalido('El número de serie del QR no es válido.');
  const m = RE_FECHA_QR.exec(fecha);
  const fechaIso = m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  if (!m || !esFechaIso(fechaIso)) return invalido('La fecha del QR no es válida (dd-mm-aaaa).');
  if (!RE_IMPORTE.test(importeTxt)) return invalido('El importe del QR no es válido.');
  const importe = Number(importeTxt);

  const base = `https://${url.hostname}${url.pathname}`;
  const canonica =
    `${base}?nif=${encodeURIComponent(nif)}&numserie=${encodeURIComponent(numserie)}` +
    `&fecha=${encodeURIComponent(fecha)}&importe=${importe.toFixed(2)}`;
  return { ok: true, datos: { url: canonica, nif, numserie, fecha, fechaIso, importe, noVerifactu, sandbox } };
}

export interface DatosFormularioQr {
  nif: string;
  numero: string;
  /** `yyyy-MM-dd` o vacío. */
  fechaExpedicion: string;
  total: number;
}

const TOLERANCIA_TOTAL = 0.011;

/** Diferencias entre el QR y el formulario como avisos legibles. Los campos aún vacíos del formulario no cuentan. */
export function contrastarQr(qr: DatosQrFactura, form: DatosFormularioQr): string[] {
  const avisos: string[] = [];
  if (form.nif.trim() && normalizarNif(form.nif) !== normalizarNif(qr.nif)) {
    avisos.push(`El NIF del emisor (${form.nif.trim()}) no coincide con el del QR (${qr.nif}).`);
  }
  if (form.numero.trim() && form.numero.trim().toUpperCase() !== qr.numserie.trim().toUpperCase()) {
    avisos.push(`El número de factura (${form.numero.trim()}) no coincide con el del QR (${qr.numserie}).`);
  }
  if (form.fechaExpedicion && form.fechaExpedicion !== qr.fechaIso) {
    avisos.push(`La fecha de expedición (${form.fechaExpedicion}) no coincide con la del QR (${qr.fechaIso}).`);
  }
  if (Number.isFinite(form.total) && Math.abs(form.total - qr.importe) > TOLERANCIA_TOTAL) {
    avisos.push(`El total (${form.total.toFixed(2)}) no coincide con el importe del QR (${qr.importe.toFixed(2)}).`);
  }
  return avisos;
}
