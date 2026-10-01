import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { validarNif } from './nif';

/**
 * Valida el NIF español solo cuando `tipo()` es `'nif'`. El valor vacío es válido: la
 * obligatoriedad (p. ej. con Verifactu) la decide quien monta el formulario con `Validators.required`.
 * Error: `{ nif: 'formato' | 'control' }`.
 */
export function nifValidator(tipo: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (tipo() !== 'nif') return null;
    const resultado = validarNif(String(control.value ?? ''));
    if (resultado.ok || resultado.motivo === 'vacio') return null;
    return { nif: resultado.motivo };
  };
}
