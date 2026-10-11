import { decimalesMoneda, monedaDeEmpresa, paisDeEmpresa, paisPorCodigo } from '../paises/catalogo-paises';
import { simboloMoneda, type FormatoImporte } from './formatear-importe';

/** Formato de importes del despacho. Sin `moneda`/`pais` (empresas previas al backfill) cae a EUR / es-ES. */
export function formatoDeEmpresa(c: { pais?: unknown; moneda?: unknown } | null | undefined): FormatoImporte {
  const moneda = monedaDeEmpresa(c);
  return { moneda, locale: paisPorCodigo(paisDeEmpresa(c)).locale, decimales: decimalesMoneda(moneda) };
}

/** Atributo `step` de un input de importe: `'0.01'` con decimales, `'1'` sin ellos. */
export function stepImporte(decimales: number): string {
  return decimales > 0 ? (1 / 10 ** decimales).toFixed(decimales) : '1';
}

export function simboloDeFormato(f: FormatoImporte): string {
  return simboloMoneda(f.moneda, f.locale);
}
