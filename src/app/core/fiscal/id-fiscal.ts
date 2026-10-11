import { paisPorCodigo, type CodigoPais } from '../paises/catalogo-paises';
import { validarNif } from './nif';

export type ResultadoIdFiscal = { ok: true } | { ok: false; motivo: 'formato' | 'control' };

/**
 * Valida un identificador fiscal según el país. España: NIF/CIF/NIE con dígito de control.
 * Resto: solo la forma del catálogo (`patronIdFiscal`), sin dígito verificador. Vacío es válido:
 * la obligatoriedad la decide quien monta el formulario.
 */
export function validarIdFiscal(pais: CodigoPais, valor: string): ResultadoIdFiscal {
  const v = valor.trim();
  if (v === '') return { ok: true };
  if (pais === 'ES') {
    const r = validarNif(v);
    if (r.ok || r.motivo === 'vacio') return { ok: true };
    return { ok: false, motivo: r.motivo };
  }
  return paisPorCodigo(pais).patronIdFiscal.test(v) ? { ok: true } : { ok: false, motivo: 'formato' };
}
