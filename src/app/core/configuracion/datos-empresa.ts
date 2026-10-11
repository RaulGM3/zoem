import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { UbicacionEmpresa } from '../services/company.service';
import { paisPorCodigo, type CodigoPais } from '../paises/catalogo-paises';

export type TipoPersonaEmpresa = 'fisica' | 'juridica';

export interface DatosEmpresaForm {
  tipoPersona: TipoPersonaEmpresa;
  name: string;
  cif: string;
  email: string;
  telefono: string;
  direccion: string;
  codigoPostal: string;
  ciudad: string;
  website: string;
  zonaHoraria: string;
  /** Place ID y coordenadas de la ciudad elegida con Places; `null` = quitarla; ausente = no tocar. */
  ubicacion?: UbicacionEmpresa | null;
}

export interface DatosEmpresaPayload {
  tipoPersona: TipoPersonaEmpresa;
  name: string;
  cif?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  codigoPostal?: string;
  ciudad?: string;
  website?: string;
  zonaHoraria: string;
  ubicacion?: UbicacionEmpresa | null;
}

const limpio = (v: string | null | undefined): string | undefined => {
  const t = (v ?? '').trim();
  return t === '' ? undefined : t;
};

/** trim, vacío -> undefined, CIF/NIF en mayúsculas, website con https:// si falta protocolo. */
export function normalizarDatosEmpresa(raw: DatosEmpresaForm): DatosEmpresaPayload {
  const website = limpio(raw.website);
  return {
    tipoPersona: raw.tipoPersona,
    name: raw.name.trim(),
    cif: limpio(raw.cif)?.toUpperCase(),
    email: limpio(raw.email),
    telefono: limpio(raw.telefono),
    direccion: limpio(raw.direccion),
    codigoPostal: limpio(raw.codigoPostal),
    ciudad: limpio(raw.ciudad),
    website: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website,
    zonaHoraria: raw.zonaHoraria,
    // La ubicación solo vale mientras haya ciudad; sin ella (o si se pidió quitarla) se limpia.
    ...(raw.ubicacion === undefined ? {} : { ubicacion: limpio(raw.ciudad) && raw.ubicacion ? raw.ubicacion : null }),
  };
}

/** Código postal con los dígitos del país (ES y MX 5, CO 6, CL 7). `pais` se lee al validar. */
export function codigoPostalValidatorPara(pais: () => CodigoPais): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value ?? '').trim();
    const digitos = paisPorCodigo(pais()).digitosCodigoPostal;
    return v === '' || new RegExp(`^\\d{${digitos}}$`).test(v) ? null : { codigoPostal: true };
  };
}

/** Id fiscal (NIF/CIF, NIT, RUT, RFC): solo longitud y caracteres, sin dígito verificador. */
export function cifValidatorPara(pais: () => CodigoPais): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value ?? '').trim();
    return v === '' || paisPorCodigo(pais()).patronIdFiscal.test(v) ? null : { cif: true };
  };
}

export const codigoPostalValidator: ValidatorFn = codigoPostalValidatorPara(() => 'ES');
export const cifValidator: ValidatorFn = cifValidatorPara(() => 'ES');
