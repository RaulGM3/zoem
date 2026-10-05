// Interpreta el HTML de la consulta pública ValidarQR de la AEAT. Función pura.
//
// Observado (2026-10-05, ver testing/validarqr-*.html): la página es HTML ISO-8859-15 con el resultado dentro de
// <main id="acc-main">; un rechazo se muestra como `<div class="alert alert-danger"> ... <b>ERROR: </b>texto</p>`.
// Con parámetros ficticios (NIF no censado) solo se pudo capturar ese caso. La redacción de "encontrada",
// "no encontrada" y "no verificable" NO se ha observado: se reconoce por texto (sin acentos, minúsculas) y todo lo
// que no se reconozca es 'error' (nunca un falso "encontrada").
// TODO(pending-user 7.1): contrastar con capturas reales y sustituir las fixtures sintéticas.

import type { EstadoQr } from './estadoQr';

export interface ResultadoValidarQr {
  estado: Extract<EstadoQr, 'encontrada' | 'no_encontrada' | 'no_verificable' | 'error'>;
  /** Texto del resultado (o motivo en `error`). */
  mensaje?: string;
}

const MAX_MENSAJE = 300;

const ENTIDADES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&aacute;': 'á',
  '&eacute;': 'é',
  '&iacute;': 'í',
  '&oacute;': 'ó',
  '&uacute;': 'ú',
  '&ntilde;': 'ñ',
};

function textoPlano(fragmento: string): string {
  return fragmento
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const sinAcentos = (t: string): string => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function parseValidarQr(html: string): ResultadoValidarQr {
  const m = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  const texto = m ? textoPlano(m[1]) : '';
  if (!texto) return { estado: 'error', mensaje: 'Respuesta de la AEAT no reconocida.' };
  const mensaje = texto.slice(0, MAX_MENSAJE);
  const t = sinAcentos(texto);

  if (/\bno (es |resulta )?verificable|\bnoverifactu\b/.test(t)) return { estado: 'no_verificable', mensaje };
  if (/\bno (se ha |ha sido |fue )?(encontrad[ao]|localizad[ao])|\bno existe\b/.test(t)) {
    return { estado: 'no_encontrada', mensaje };
  }
  if (/\b(encontrad[ao]|localizad[ao])\b/.test(t)) return { estado: 'encontrada', mensaje };
  return { estado: 'error', mensaje };
}
