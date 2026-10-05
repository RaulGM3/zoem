// Espejo de `src/app/core/facturas-recibidas/qr-verifactu.ts` (functions no puede importar de `src/app`):
// mantener ambos sincronizados. Solo se aceptan URLs de la AEAT (ValidarQR / ValidarQRNoVerifactu, pruebas
// y producción; mismos hosts que `endpoints.ts`) y la URL devuelta se RECONSTRUYE desde los parámetros ya
// validados: nunca se consulta el texto almacenado tal cual (SSRF).

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

export interface QrVerifactu {
  nif: string;
  numserie: string;
  /** `dd-MM-yyyy`, tal cual viaja en el QR. */
  fecha: string;
  /** `yyyy-MM-dd`. */
  fechaIso: string;
  importe: number;
  /** URL canónica reconstruida (la única que se consulta). */
  url: string;
  noVerifactu: boolean;
  sandbox: boolean;
}

export type ResultadoParseQr = { ok: true; datos: QrVerifactu } | { ok: false; motivo: string };

const invalido = (motivo: string): ResultadoParseQr => ({ ok: false, motivo });

function esFechaCalendario(anio: number, mes: number, dia: number): boolean {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

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
  if (!m || !esFechaCalendario(Number(m[3]), Number(m[2]), Number(m[1]))) {
    return invalido('La fecha del QR no es válida (dd-mm-aaaa).');
  }
  const fechaIso = `${m[3]}-${m[2]}-${m[1]}`;
  if (!RE_IMPORTE.test(importeTxt)) return invalido('El importe del QR no es válido.');
  const importe = Number(importeTxt);

  const canonica =
    `https://${url.hostname}${url.pathname}?nif=${encodeURIComponent(nif)}&numserie=${encodeURIComponent(numserie)}` +
    `&fecha=${encodeURIComponent(fecha)}&importe=${importe.toFixed(2)}`;
  return { ok: true, datos: { nif, numserie, fecha, fechaIso, importe, url: canonica, noVerifactu, sandbox } };
}
