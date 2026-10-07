import type { ComunidadAutonoma } from '../../interfaces/company';
import { PARTIDOS_JUDICIALES } from './partidos-judiciales.data';

export interface PartidoJudicial {
  /** `${códigoProvinciaINE}-${nº de partido en la provincia}`, p. ej. '28-4'. */
  id: string;
  /** Municipio sede del partido. */
  nombre: string;
  ine: string;
  provincia: string;
  ca: ComunidadAutonoma;
}

export { PARTIDOS_JUDICIALES };

const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

const INDICE = PARTIDOS_JUDICIALES.map((partido) => ({ partido, clave: normalizar(partido.nombre), provincia: normalizar(partido.provincia) }));

export interface OpcionesBusqueda {
  /** Comunidad cuyos resultados se muestran primero. */
  ca?: ComunidadAutonoma;
  limite?: number;
}

/**
 * Busca partidos por municipio sede (o provincia), sin distinguir tildes ni mayúsculas.
 * Orden: comunidad indicada primero; dentro, coincidencias por prefijo antes que por "contiene".
 */
export function buscarPartidos(texto: string, opciones: OpcionesBusqueda = {}): PartidoJudicial[] {
  const q = normalizar(texto);
  if (!q) return [];
  const puntuar = (e: (typeof INDICE)[number]): number | null => {
    if (e.clave.startsWith(q)) return 0;
    if (e.clave.split(/[\s/-]+/).some((w) => w.startsWith(q)) || e.clave.includes(q)) return 1;
    if (e.provincia.startsWith(q)) return 2;
    return null;
  };
  const r = INDICE.flatMap((e) => {
    const p = puntuar(e);
    return p === null ? [] : [{ e, p, propia: opciones.ca && e.partido.ca === opciones.ca ? 0 : 1 }];
  });
  r.sort((a, b) => a.propia - b.propia || a.p - b.p || a.e.clave.localeCompare(b.e.clave, 'es'));
  return r.slice(0, opciones.limite ?? r.length).map((x) => x.e.partido);
}

export const partidoPorId = (id: string): PartidoJudicial | undefined => PARTIDOS_JUDICIALES.find((p) => p.id === id);
