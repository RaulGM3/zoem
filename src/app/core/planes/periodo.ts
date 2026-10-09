/**
 * Periodo de uso mensual en la zona horaria de la empresa (IANA), con Intl y sin dependencias.
 * Las security rules no pueden hacer aritmética de zonas: el resultado se denormaliza en
 * `companies/{cid}.derechos.periodoUso` (ver planes/derechosDoc.ts).
 *
 * COPIA IDÉNTICA en src/app/core/planes/periodo.ts (sincronia.spec.ts lo vigila).
 * Funciones puras: `ahora` siempre llega por parámetro.
 */

export const ZONA_POR_DEFECTO = 'Europe/Madrid';

export interface PeriodoMensual {
  /** 'yyyy-mm' del mes local; es el id del doc `uso/{clave}`. */
  clave: string;
  /** Primer instante del mes local (incluido). */
  inicio: Date;
  /** Primer instante del mes siguiente (excluido). */
  fin: Date;
}

const ZONA_RE = /^(UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/;

/** ¿Es un identificador IANA que Intl conoce? Rechaza offsets ('+01:00'), vacíos y basura. */
export function esZonaValida(zona: unknown): zona is string {
  if (typeof zona !== 'string' || zona.length === 0 || zona.length > 64 || !ZONA_RE.test(zona)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateador(zona: string): Intl.DateTimeFormat {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zona, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formateadores.set(zona, f);
  }
  return f;
}

/** Fecha/hora local de un instante, expresada como "ms UTC" de esa misma fecha/hora de pared. */
function paredEnMs(ms: number, zona: string): { y: number; m: number; pared: number } {
  const p: Record<string, number> = {};
  for (const parte of formateador(zona).formatToParts(new Date(ms))) {
    if (parte.type !== 'literal') p[parte.type] = Number(parte.value);
  }
  return { y: p['year'], m: p['month'], pared: Date.UTC(p['year'], p['month'] - 1, p['day'], p['hour'], p['minute'], p['second']) };
}

function offsetEn(ms: number, zona: string): number {
  const base = Math.floor(ms / 1000) * 1000;
  return paredEnMs(base, zona).pared - base;
}

/**
 * Primer instante cuya hora de pared en `zona` es el día 1, 00:00 de (año, mes). Si esa hora de
 * pared no existe (salto de reloj a medianoche) devuelve el instante del salto; si se repite,
 * la primera ocurrencia.
 */
function inicioDeMes(anio: number, mes: number, zona: string): number {
  const objetivo = Date.UTC(anio, mes - 1, 1);
  const DIA = 86_400_000;
  const candidatos = new Set([objetivo - offsetEn(objetivo - DIA, zona), objetivo - offsetEn(objetivo + DIA, zona)]);
  const validos = [...candidatos].filter((t) => paredEnMs(t, zona).pared === objetivo);
  return validos.length > 0 ? Math.min(...validos) : Math.max(...candidatos);
}

export function periodoMensual(ahora: Date, zona: string): PeriodoMensual {
  if (!esZonaValida(zona)) throw new RangeError(`Zona horaria no válida: ${zona}`);
  const { y, m } = paredEnMs(ahora.getTime(), zona);
  const siguiente = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  return {
    clave: `${y}-${String(m).padStart(2, '0')}`,
    inicio: new Date(inicioDeMes(y, m, zona)),
    fin: new Date(inicioDeMes(siguiente.y, siguiente.m, zona)),
  };
}

/** Zona de una empresa: la guardada si es válida; si no (legada, vacía, corrupta) Europe/Madrid. */
export function zonaDeEmpresa(empresa: { zonaHoraria?: unknown } | undefined): string {
  const z = empresa?.zonaHoraria;
  return esZonaValida(z) ? z : ZONA_POR_DEFECTO;
}
