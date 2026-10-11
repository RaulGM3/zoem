// Validación pura del alta en autoservicio (sin Firebase): testeable y reutilizable.
import { esCodigoPais, paisPorCodigo, regionEnPais, type CodigoPais } from '../paises/catalogo-paises';
import { esZonaValida } from '../uso/periodo';

export interface Ubicacion {
  placeId: string;
  lat: number;
  lng: number;
}

export interface AltaEmpresa {
  nombre: string;
  tipoPersona: 'fisica' | 'juridica';
  pais: CodigoPais;
  /** España: slug de la comunidad (se guarda como `ca`). Resto: código ISO 3166-2 (se guarda como `region`). */
  region: string;
  /** Fija desde el alta: solo el servidor o el superusuario la cambian. */
  moneda: string;
  ciudad?: string;
  ubicacion?: Ubicacion;
  rubro: 'abogados';
  especialidad?: string;
  /** IANA; define el mes de los cupos mensuales. */
  zonaHoraria: string;
}

export type Validacion<T> = { ok: true; valor: T } | { ok: false; campos: string[] };

const NOMBRE_MIN = 2;
const NOMBRE_MAX = 120;
const ESPECIALIDAD_MAX = 120;
const CIUDAD_MAX = 120;
const PLACE_ID_MAX = 300;

function registro(data: unknown): Record<string, unknown> {
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
}

function nombreValido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const n = valor.trim();
  return n.length >= NOMBRE_MIN && n.length <= NOMBRE_MAX ? n : null;
}

/** Opcional: vacío/ausente => la zona por defecto del país; presente pero inválido => error. */
function zonaOpcional(valor: unknown, defecto: string): string | null {
  if (valor === undefined || valor === null || valor === '') return defecto;
  return esZonaValida(valor) ? valor : null;
}

/** Ausente => 'ES' (clientes anteriores al soporte multipaís); presente pero fuera del catálogo => null. */
function paisOpcional(valor: unknown): CodigoPais | null {
  if (valor === undefined || valor === null || valor === '') return 'ES';
  return esCodigoPais(valor) ? valor : null;
}

/** Ausente => la moneda local; presente pero no permitida para el país => null. */
function monedaOpcional(valor: unknown, pais: CodigoPais): string | null {
  const p = paisPorCodigo(pais);
  if (valor === undefined || valor === null || valor === '') return p.moneda;
  return typeof valor === 'string' && p.monedasPermitidas.includes(valor) ? valor : null;
}

function ubicacionValida(valor: unknown): Ubicacion | null {
  const u = registro(valor);
  const { placeId, lat, lng } = u;
  if (typeof placeId !== 'string' || placeId.length === 0 || placeId.length > PLACE_ID_MAX) return null;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return { placeId, lat, lng };
}

export function validarAlta(data: unknown): Validacion<AltaEmpresa> {
  const d = registro(data);
  const campos: string[] = [];

  const nombre = nombreValido(d['nombre']);
  if (!nombre) campos.push('nombre');
  if (d['tipoPersona'] !== 'fisica' && d['tipoPersona'] !== 'juridica') campos.push('tipoPersona');

  const pais = paisOpcional(d['pais']);
  if (!pais) campos.push('pais');

  // Un cliente anterior mandaba `ca`; en España se sigue aceptando.
  const region = d['region'] ?? (pais === 'ES' ? d['ca'] : undefined);
  if (pais && !regionEnPais(pais, region)) campos.push('region');

  const moneda = pais ? monedaOpcional(d['moneda'], pais) : null;
  if (pais && !moneda) campos.push('moneda');

  const zonaHoraria = zonaOpcional(d['zonaHoraria'], pais ? paisPorCodigo(pais).zonaPorDefecto : 'Europe/Madrid');
  if (!zonaHoraria) campos.push('zonaHoraria');

  let ciudad: string | undefined;
  if (d['ciudad'] !== undefined && d['ciudad'] !== null && d['ciudad'] !== '') {
    if (typeof d['ciudad'] === 'string' && d['ciudad'].trim().length <= CIUDAD_MAX) {
      ciudad = d['ciudad'].trim() || undefined;
    } else {
      campos.push('ciudad');
    }
  }

  let ubicacion: Ubicacion | undefined;
  if (d['ubicacion'] !== undefined && d['ubicacion'] !== null) {
    ubicacion = ubicacionValida(d['ubicacion']) ?? undefined;
    if (!ubicacion) campos.push('ubicacion');
  }

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
      pais: pais!,
      region: region as string,
      moneda: moneda!,
      rubro: 'abogados',
      zonaHoraria: zonaHoraria!,
      ...(ciudad ? { ciudad } : {}),
      ...(ubicacion ? { ubicacion } : {}),
      ...(especialidad ? { especialidad } : {}),
    },
  };
}

export interface AltaDemo {
  nombre: string;
  pais: CodigoPais;
  moneda: string;
  zonaHoraria: string;
}

export function validarAltaDemo(data: unknown): Validacion<AltaDemo> {
  const d = registro(data);
  const nombre = nombreValido(d['nombre']);
  const pais = paisOpcional(d['pais']);
  const moneda = pais ? monedaOpcional(d['moneda'], pais) : null;
  const zonaHoraria = zonaOpcional(d['zonaHoraria'], pais ? paisPorCodigo(pais).zonaPorDefecto : 'Europe/Madrid');
  const campos = [
    ...(nombre ? [] : ['nombre']),
    ...(pais ? [] : ['pais']),
    ...(pais && !moneda ? ['moneda'] : []),
    ...(zonaHoraria ? [] : ['zonaHoraria']),
  ];
  return campos.length === 0
    ? { ok: true, valor: { nombre: nombre!, pais: pais!, moneda: moneda!, zonaHoraria: zonaHoraria! } }
    : { ok: false, campos };
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
