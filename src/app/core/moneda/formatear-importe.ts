/**
 * Formato de importes por moneda — funciones puras, sin Angular ni DI.
 * Sustituye al `| number:'1.2-2'` + ` €` escrito a mano.
 */

export interface FormatoImporte {
  /** Código ISO 4217 (`EUR`, `COP`…). */
  moneda: string;
  /** BCP 47 (`es-ES`, `es-CO`…). Define separadores y posición del símbolo. */
  locale: string;
  /** Decimales que muestra la moneda (EUR 2, COP 0). */
  decimales: number;
}

/** Un `Intl.NumberFormat` por combinación: crearlos es lo caro, y la pipe se evalúa en cada ciclo. */
const cache = new Map<string, Intl.NumberFormat>();

function formateador(f: FormatoImporte): Intl.NumberFormat {
  const clave = `${f.locale}|${f.moneda}|${f.decimales}`;
  let nf = cache.get(clave);
  if (!nf) {
    nf = new Intl.NumberFormat(f.locale, {
      style: 'currency',
      currency: f.moneda,
      minimumFractionDigits: f.decimales,
      maximumFractionDigits: f.decimales,
      // es-ES no agrupa los miles de 4 cifras (1234,50): aquí sí (1.234,50), como en los listados.
      useGrouping: 'always',
      // Un -0,001 que redondea a 0 no debe verse como «-0,00».
      signDisplay: 'negative',
    } as unknown as Intl.NumberFormatOptions);
    cache.set(clave, nf);
  }
  return nf;
}

/** `''` si no hay valor (igual que el pipe `number`, que devolvía `null`). */
export function formatearImporte(valor: number | null | undefined, formato: FormatoImporte): string {
  if (valor === null || valor === undefined) return '';
  const n = Number(valor);
  if (!Number.isFinite(n)) return '';
  try {
    return formateador(formato).format(n);
  } catch {
    // Moneda o locale inválidos en datos antiguos: mejor un número plano que romper la vista.
    return String(n);
  }
}

/** Para textos que se guardan (actividad, conceptos): espacio normal en vez de NBSP, que se busca y copia mal. */
export function formatearImporteTexto(valor: number | null | undefined, formato: FormatoImporte): string {
  return formatearImporte(valor, formato).replace(/[\u00A0\u202F]/g, ' ');
}

/** Redondeo comercial (la mitad se aleja de cero) sin los errores de coma flotante de `toFixed`. */
export function redondear(valor: number, decimales: number): number {
  if (!Number.isFinite(valor)) return 0;
  const signo = valor < 0 ? -1 : 1;
  const abs = Math.abs(valor);
  const desplazado = Math.round(Number(`${abs}e${decimales}`));
  return signo * Number(`${desplazado}e-${decimales}`) || 0;
}

/** Símbolo para etiquetas («Importe (€)»). Si Intl no lo conoce, el código de la moneda. */
export function simboloMoneda(moneda: string, locale: string): string {
  try {
    const partes = new Intl.NumberFormat(locale, { style: 'currency', currency: moneda }).formatToParts(0);
    return partes.find((p) => p.type === 'currency')?.value ?? moneda;
  } catch {
    return moneda;
  }
}
