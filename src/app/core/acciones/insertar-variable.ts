import { construirContextoAccion } from './contexto-accion';

export interface VariableAccion {
  key: string;
  /** Texto accesible del chip. */
  label: string;
}

const ETIQUETAS: Record<string, string> = {
  cliente: 'Cliente',
  nombre: 'Nombre',
  contacto: 'Contacto',
  email: 'Email',
  telefono: 'Teléfono',
  caso: 'Caso',
  asunto: 'Asunto del contacto',
  tipo: 'Tipo de caso',
  descripcion: 'Descripción del caso',
  vencimiento: 'Vencimiento',
  hito: 'Hito',
  hito_descripcion: 'Descripción del hito',
  empresa: 'Empresa',
  fecha: 'Fecha',
  hoy: 'Hoy',
};

/** Variables disponibles = claves de `construirContextoAccion` (una sola fuente de verdad). */
export const VARIABLES_ACCION: readonly VariableAccion[] = Object.keys(
  construirContextoAccion({ contactos: [], empresa: '', hoy: new Date(0) }),
).map((key) => ({ key, label: ETIQUETAS[key] ?? key }));

/** Inserta `{{key}}` sustituyendo la selección [inicio, fin); sin posición, al final. */
export function insertarVariable(
  texto: string,
  key: string,
  inicio: number | null,
  fin: number | null,
): { texto: string; cursor: number } {
  const ini = inicio ?? texto.length;
  const end = fin ?? ini;
  const token = `{{${key}}}`;
  return { texto: texto.slice(0, ini) + token + texto.slice(end), cursor: ini + token.length };
}
