// GENERADO desde src/app/core/plazos — no editar; ejecutar `npm run sync:plazos`
/** Alias local: en functions no existe la interfaz de la app. */
type ComunidadAutonoma = string;

/*
 * Días rojos (inhábiles por festivo) organizados en capas por año.
 * Principio rector: un día rojo FALSO alarga el plazo y es peligroso; por eso solo los
 * días `confirmado` por un humano participan en el cómputo.
 */

export type AmbitoDiaRojo = 'nacional' | 'autonomico' | 'local' | 'personalizado';
export type EstadoDiaRojo = 'propuesto' | 'confirmado';
export type OrigenDiaRojo = 'ia' | 'manual';

export interface DiaRojo {
  /** ISO 'YYYY-MM-DD'. */
  fecha: string;
  nombre: string;
  ambito: AmbitoDiaRojo;
  estado: EstadoDiaRojo;
  origen: OrigenDiaRojo;
  fuenteUrl?: string;
  confirmadoPor?: string;
  confirmadoAt?: string;
}

export interface BusquedaIa {
  ejecutadaAt: string;
  ejecutadaPor: string;
  propuestos: number;
}

/** Contenido de una capa para un año: `calendariosJudiciales/{capaId}/anios/{anio}`. */
export interface CapaAnio {
  diasRojos: DiaRojo[];
  /** Fechas que el usuario quitó: la IA no puede volver a proponerlas. */
  descartados: string[];
  ultimaBusquedaIa?: BusquedaIa;
}

export interface PropuestaIa {
  fecha: string;
  nombre: string;
  ambito: AmbitoDiaRojo;
  fuenteUrl?: string;
}

export type MotivoDescarte =
  | 'sin_fuente'
  | 'dominio_no_oficial'
  | 'dominio_fuera_de_busqueda'
  | 'otro_anio'
  | 'descartado_por_usuario'
  | 'ya_existe'
  | 'duplicada';

export const idCapaAutonomica = (ca: ComunidadAutonoma): string => `ca-${ca}`;
export const idCapaPartido = (partidoId: string): string => `pj-${partidoId}`;

/** Compone los días confirmados de la capa autonómica y la del partido (el partido gana en la misma fecha). */
export function componerDiasRojos(capaCA?: CapaAnio, capaPartido?: CapaAnio): Map<string, DiaRojo> {
  const mapa = new Map<string, DiaRojo>();
  for (const capa of [capaCA, capaPartido]) {
    for (const d of capa?.diasRojos ?? []) {
      if (d.estado === 'confirmado') mapa.set(d.fecha, d);
    }
  }
  return mapa;
}

/**
 * Sufijos de dominio considerados fuente oficial (se compara por sufijo de host, no por substring):
 * BOE, administración general (gob.es) y boletines/portales de las comunidades autónomas.
 * Los boletines provinciales (bop.*, dipu*) se cubren con `PATRON_PROVINCIAL`.
 */
export const DOMINIOS_OFICIALES: readonly string[] = [
  'boe.es', 'gob.es', 'bocm.es', 'borm.es', 'bocce.es',
  'gencat.cat', 'juntadeandalucia.es', 'euskadi.eus', 'xunta.gal', 'gva.es', 'caib.es', 'navarra.es',
  'larioja.org', 'jcyl.es', 'carm.es', 'aragon.es', 'asturias.es', 'cantabria.es', 'castillalamancha.es',
  'jccm.es', 'juntaex.es', 'comunidad.madrid', 'madrid.org', 'gobiernodecanarias.org', 'ceuta.es', 'melilla.es',
];

/** Hosts de diputaciones y boletines oficiales de provincia: bop.xxx.es, dipuxxx.es, etc. */
const PATRON_PROVINCIAL = /(^|\.)(bop[a-z0-9-]*|dipu[a-z0-9-]*)\.[a-z0-9.-]*(es|eus|cat|gal)$/;

const hostDe = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

const sufijo = (host: string, dominio: string): boolean => host === dominio || host.endsWith(`.${dominio}`);

export function esDominioOficial(url: string): boolean {
  const host = hostDe(url);
  if (!host) return false;
  return DOMINIOS_OFICIALES.some((d) => sufijo(host, d)) || PATRON_PROVINCIAL.test(host);
}

function enGrounding(host: string, dominiosGrounding: readonly string[]): boolean {
  return dominiosGrounding.some((g) => {
    const dom = g.toLowerCase().replace(/^www\./, '');
    return sufijo(host, dom) || sufijo(dom, host);
  });
}

/**
 * Fusión pura e idempotente de propuestas de la IA en una capa.
 * No toca nunca días confirmados ni manuales; los propuestos existentes solo actualizan nombre y fuente.
 */
export function fusionarPropuestas(
  actual: CapaAnio,
  propuestas: readonly PropuestaIa[],
  anio: number,
  dominiosGrounding: readonly string[],
): { capa: CapaAnio; añadidos: number; descartadas: { fecha: string; motivo: MotivoDescarte }[] } {
  const diasRojos = actual.diasRojos.map((d) => ({ ...d }));
  const descartadas: { fecha: string; motivo: MotivoDescarte }[] = [];
  const vistas = new Set<string>();
  let añadidos = 0;

  for (const p of propuestas) {
    const descartar = (motivo: MotivoDescarte) => descartadas.push({ fecha: p.fecha, motivo });
    const host = p.fuenteUrl ? hostDe(p.fuenteUrl) : null;

    if (!p.fuenteUrl) { descartar('sin_fuente'); continue; }
    if (!host || !esDominioOficial(p.fuenteUrl)) { descartar('dominio_no_oficial'); continue; }
    if (dominiosGrounding.length > 0 && !enGrounding(host, dominiosGrounding)) { descartar('dominio_fuera_de_busqueda'); continue; }
    if (!p.fecha.startsWith(`${anio}-`)) { descartar('otro_anio'); continue; }
    if (actual.descartados.includes(p.fecha)) { descartar('descartado_por_usuario'); continue; }
    if (vistas.has(p.fecha)) { descartar('duplicada'); continue; }
    vistas.add(p.fecha);

    const existente = diasRojos.find((d) => d.fecha === p.fecha);
    if (existente) {
      if (existente.estado === 'propuesto' && existente.origen === 'ia') {
        existente.nombre = p.nombre;
        existente.fuenteUrl = p.fuenteUrl;
      } else {
        descartar('ya_existe');
      }
      continue;
    }
    diasRojos.push({ fecha: p.fecha, nombre: p.nombre, ambito: p.ambito, estado: 'propuesto', origen: 'ia', fuenteUrl: p.fuenteUrl });
    añadidos++;
  }

  return { capa: { ...actual, diasRojos }, añadidos, descartadas };
}
