import type { AbstractControl, ValidationErrors } from '@angular/forms';

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
  };
}

export function codigoPostalValidator(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '').trim();
  return v === '' || /^\d{5}$/.test(v) ? null : { codigoPostal: true };
}

export function cifValidator(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '').trim();
  return v === '' || /^[A-Za-z0-9]{9}$/.test(v) ? null : { cif: true };
}
