/**
 * Validador puro de NIF/NIE/NIF de entidad español. Sin dependencias de framework.
 *
 * Mantener idéntico a `functions/src/aeat/nif.ts` (functions no puede importar de `src/app`
 * por su rootDir, así que se espeja; ambos specs usan la misma tabla de casos).
 */

export type ClaseNif = 'dni' | 'nie' | 'nif-especial' | 'entidad';

export type MotivoNifInvalido = 'vacio' | 'formato' | 'control';

export type ResultadoNif = { ok: true; clase: ClaseNif; valor: string } | { ok: false; motivo: MotivoNifInvalido };

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const LETRAS_CONTROL_ENTIDAD = 'JABCDEFGHI';
/** Entidades cuyo control debe ser letra / dígito; el resto admite cualquiera. */
const ENTIDAD_SOLO_LETRA = 'PQRSNW';
const ENTIDAD_SOLO_DIGITO = 'ABEH';

const RE_DNI = /^(\d{8})([A-Z])$/;
const RE_NIE = /^([XYZ])(\d{7})([A-Z])$/;
const RE_ESPECIAL = /^[KLM](\d{7})([A-Z])$/;
const RE_ENTIDAD = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/;

/** Mayúsculas, sin espacios/guiones/puntos/barras y sin el prefijo `ES` (si quedan 9 caracteres). */
export function normalizarNif(valor: string): string {
  const limpio = valor.toUpperCase().replace(/[\s\-./]/g, '');
  return limpio.length === 11 && limpio.startsWith('ES') ? limpio.slice(2) : limpio;
}

function letraDni(numero: number): string {
  return LETRAS_DNI[numero % 23];
}

function controlEntidad(digitos: string): number {
  const d = digitos.split('').map(Number);
  const pares = d[1] + d[3] + d[5];
  const impares = [d[0], d[2], d[4], d[6]].reduce((acc, x) => acc + Math.floor((2 * x) / 10) + ((2 * x) % 10), 0);
  return (10 - ((pares + impares) % 10)) % 10;
}

function controlEntidadValido(prefijo: string, digitos: string, control: string): boolean {
  const c = controlEntidad(digitos);
  const esDigito = /\d/.test(control);
  if (ENTIDAD_SOLO_LETRA.includes(prefijo) && esDigito) return false;
  if (ENTIDAD_SOLO_DIGITO.includes(prefijo) && !esDigito) return false;
  return control === String(c) || control === LETRAS_CONTROL_ENTIDAD[c];
}

export function validarNif(valor: string): ResultadoNif {
  const nif = normalizarNif(valor);
  if (nif === '') return { ok: false, motivo: 'vacio' };

  const dni = RE_DNI.exec(nif);
  if (dni) {
    return letraDni(Number(dni[1])) === dni[2] ? { ok: true, clase: 'dni', valor: nif } : { ok: false, motivo: 'control' };
  }

  const nie = RE_NIE.exec(nif);
  if (nie) {
    const n = Number(`${'XYZ'.indexOf(nie[1])}${nie[2]}`);
    return letraDni(n) === nie[3] ? { ok: true, clase: 'nie', valor: nif } : { ok: false, motivo: 'control' };
  }

  const especial = RE_ESPECIAL.exec(nif);
  if (especial) {
    return letraDni(Number(especial[1])) === especial[2]
      ? { ok: true, clase: 'nif-especial', valor: nif }
      : { ok: false, motivo: 'control' };
  }

  const entidad = RE_ENTIDAD.exec(nif);
  if (entidad) {
    return controlEntidadValido(entidad[1], entidad[2], entidad[3])
      ? { ok: true, clase: 'entidad', valor: nif }
      : { ok: false, motivo: 'control' };
  }

  return { ok: false, motivo: 'formato' };
}
