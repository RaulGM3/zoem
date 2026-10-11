import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { CodigoPais } from '../paises/catalogo-paises';
import { validarIdFiscal } from './id-fiscal';

/**
 * Valida el identificador fiscal solo cuando `tipo()` es `'nif'`. En España aplica el dígito de control
 * del NIF; en el resto de países, la forma del catálogo (NIT, RUT, RFC). El valor vacío es válido: la
 * obligatoriedad (p. ej. con Verifactu) la decide quien monta el formulario con `Validators.required`.
 * Error: `{ nif: 'formato' | 'control' }`.
 */
export function nifValidator(tipo: () => string, pais: () => CodigoPais = () => 'ES'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (tipo() !== 'nif') return null;
    const resultado = validarIdFiscal(pais(), String(control.value ?? ''));
    return resultado.ok ? null : { nif: resultado.motivo };
  };
}
