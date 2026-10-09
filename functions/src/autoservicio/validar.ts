// Validación pura del alta en autoservicio (sin Firebase): testeable y reutilizable.

export const COMUNIDADES = [
  'andalucia', 'aragon', 'asturias', 'baleares', 'canarias', 'cantabria', 'castilla_la_mancha',
  'castilla_y_leon', 'cataluna', 'extremadura', 'galicia', 'la_rioja', 'madrid', 'murcia',
  'navarra', 'pais_vasco', 'valencia', 'ceuta', 'melilla',
] as const;

export type Comunidad = (typeof COMUNIDADES)[number];

export interface AltaEmpresa {
  nombre: string;
  tipoPersona: 'fisica' | 'juridica';
  ca: Comunidad;
  rubro: 'abogados';
  especialidad?: string;
}

export type Validacion<T> = { ok: true; valor: T } | { ok: false; campos: string[] };

const NOMBRE_MIN = 2;
const NOMBRE_MAX = 120;
const ESPECIALIDAD_MAX = 80;

function registro(data: unknown): Record<string, unknown> {
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
}

function nombreValido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const n = valor.trim();
  return n.length >= NOMBRE_MIN && n.length <= NOMBRE_MAX ? n : null;
}

export function validarAlta(data: unknown): Validacion<AltaEmpresa> {
  const d = registro(data);
  const campos: string[] = [];

  const nombre = nombreValido(d['nombre']);
  if (!nombre) campos.push('nombre');
  if (d['tipoPersona'] !== 'fisica' && d['tipoPersona'] !== 'juridica') campos.push('tipoPersona');
  if (!COMUNIDADES.includes(d['ca'] as Comunidad)) campos.push('ca');

  let especialidad: string | undefined;
  if (d['especialidad'] !== undefined && d['especialidad'] !== null && d['especialidad'] !== '') {
    if (typeof d['especialidad'] === 'string' && d['especialidad'].trim().length <= ESPECIALIDAD_MAX) {
      especialidad = d['especialidad'].trim() || undefined;
    } else {
      campos.push('especialidad');
    }
  }

  if (campos.length > 0) return { ok: false, campos };
  return {
    ok: true,
    valor: {
      nombre: nombre!,
      tipoPersona: d['tipoPersona'] as AltaEmpresa['tipoPersona'],
      ca: d['ca'] as Comunidad,
      rubro: 'abogados',
      ...(especialidad ? { especialidad } : {}),
    },
  };
}

export function validarAltaDemo(data: unknown): Validacion<{ nombre: string }> {
  const nombre = nombreValido(registro(data)['nombre']);
  return nombre ? { ok: true, valor: { nombre } } : { ok: false, campos: ['nombre'] };
}

/** Claims mínimos del ID token que necesitamos (forma de `request.auth.token`). */
export interface TokenAuth {
  email_verified?: boolean;
  firebase?: { sign_in_provider?: string };
}

/** Solo cuentas con email verificado o Google (Google ya verifica el correo). */
export function autorizadoParaAutoservicio(token: TokenAuth | undefined): boolean {
  if (!token) return false;
  return token.email_verified === true || token.firebase?.sign_in_provider === 'google.com';
}

const SLUG_BASE_MAX = 40;

/** Slug legible + sufijo corto para que sea casi único (la unicidad real la da el id del doc). */
export function generarSlug(nombre: string, sufijo: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_BASE_MAX)
    .replace(/-+$/g, '');
  return `${base || 'despacho'}-${sufijo}`;
}
