import { CA_LABELS, type ComunidadAutonoma } from '../../interfaces/company';
import type { AmbitoDiaRojo, BusquedaIa, PropuestaIa } from './dias-rojos';
import { partidoPorId } from './partidos-judiciales';

/*
 * Piezas puras de la búsqueda de festivos con IA: prompt, normalización de la respuesta del modelo,
 * extracción de dominios/fuentes del grounding y enfriamiento. Sin Angular ni red.
 */

export type CapaBusqueda =
  | { tipo: 'autonomica'; ca: ComunidadAutonoma }
  | { tipo: 'partido'; partidoId: string };

export interface FuenteBusqueda {
  titulo: string;
  uri: string;
}

/** Forma mínima de `groundingMetadata.groundingChunks` (compatible con `GroundingChunk` de firebase/ai). */
export interface ChunkWeb {
  web?: { uri?: string; title?: string; domain?: string };
}

export const COOLDOWN_BUSQUEDA_HORAS = 24;

/** 'ca-madrid' / 'pj-28-21' (id de capa) -> parámetros de búsqueda; null si el id no es válido. */
export function capaBusquedaDesdeId(id: string): CapaBusqueda | null {
  if (id.startsWith('ca-')) {
    const ca = id.slice(3);
    return Object.hasOwn(CA_LABELS, ca) ? { tipo: 'autonomica', ca: ca as ComunidadAutonoma } : null;
  }
  if (id.startsWith('pj-')) {
    const partidoId = id.slice(3);
    return partidoPorId(partidoId) ? { tipo: 'partido', partidoId } : null;
  }
  return null;
}

// ---------------------------------------------------------------- prompt

const REGLA_FUENTE =
  'Para CADA fecha incluye la URL de la fuente oficial (BOE, boletín oficial autonómico o provincial). ' +
  'Si una fecha no tiene fuente oficial, NO la incluyas (sin fuente, NO la incluyas). ' +
  'No inventes fechas ni URLs: devuelve solo lo que encuentres publicado. ' +
  'Para cada día indica "fecha" (aaaa-mm-dd), "nombre", "ambito" ("nacional", "autonomico" o "local") y "fuenteUrl".';

export function construirPrompt(capa: CapaBusqueda, anio: number): string {
  if (capa.tipo === 'autonomica') {
    const nombre = CA_LABELS[capa.ca];
    return (
      `Festivos laborales ${anio} aplicables en ${nombre}: los festivos nacionales y los de la propia comunidad ` +
      `(Resolución de la Dirección General de Trabajo publicada en el BOE y boletín oficial autonómico). ` +
      `Incluye los días inhábiles a efectos laborales; ámbito "nacional" para los de toda España y "autonomico" para los de ${nombre}. ` +
      REGLA_FUENTE
    );
  }
  const partido = partidoPorId(capa.partidoId);
  if (!partido) throw new Error(`Partido judicial desconocido: ${capa.partidoId}`);
  return (
    `Fiestas locales ${anio} del municipio ${partido.nombre}, ${partido.provincia} ` +
    `(boletín oficial provincial o autonómico donde se publica el calendario laboral con las fiestas locales). ` +
    `Solo las fiestas locales de ese municipio, con ámbito "local". ` +
    REGLA_FUENTE
  );
}

// ------------------------------------------------------- parseo del JSON

const AMBITOS_IA: readonly AmbitoDiaRojo[] = ['nacional', 'autonomico', 'local'];

const esRegistro = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Acepta aaaa-mm-dd y dd/mm/aaaa (o con guiones); devuelve ISO válido o null. */
function fechaIso(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  const m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(s);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * Convierte el JSON del modelo (`{festivos: [...]}`) en propuestas. Tolerante: lo que no se pueda
 * leer con certeza se descarta aquí; las reglas de fuente/dominio/año las aplica `fusionarPropuestas`.
 */
export function parsearPropuestas(crudo: unknown, tipoCapa: CapaBusqueda['tipo']): PropuestaIa[] {
  const lista = esRegistro(crudo) && Array.isArray(crudo['festivos']) ? (crudo['festivos'] as unknown[]) : [];
  const ambitoPorDefecto: AmbitoDiaRojo = tipoCapa === 'partido' ? 'local' : 'autonomico';
  return lista.flatMap((item) => {
    if (!esRegistro(item)) return [];
    const fecha = fechaIso(item['fecha']);
    const nombre = typeof item['nombre'] === 'string' ? item['nombre'].trim() : '';
    if (!fecha || !nombre) return [];
    const ambito = AMBITOS_IA.find((a) => a === item['ambito']) ?? ambitoPorDefecto;
    const url = typeof item['fuenteUrl'] === 'string' ? item['fuenteUrl'].trim() : '';
    return [{ fecha, nombre, ambito, fuenteUrl: url || undefined }];
  });
}

// ------------------------------------------------------------- grounding

const REDIRECCION_GOOGLE = /(^|\.)vertexaisearch\.cloud\.google\.com$/i;
const PARECE_HOST = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;

const sinWww = (h: string): string => h.toLowerCase().replace(/^www\./, '');

function hostDeUri(uri: string): string | null {
  try {
    const u = new URL(uri);
    return u.protocol === 'http:' || u.protocol === 'https:' ? sinWww(u.hostname) : null;
  } catch {
    return null;
  }
}

/**
 * Dominios REALES de las páginas consultadas. En Vertex el `uri` suele ser una redirección de Google
 * (vertexaisearch…), así que el dominio real viene en `domain` o, si no, en el título.
 */
export function extraerDominios(chunks: readonly ChunkWeb[] | undefined): string[] {
  const dominios = new Set<string>();
  for (const c of chunks ?? []) {
    const w = c.web;
    if (!w) continue;
    const titulo = w.title?.trim() ?? '';
    const host = w.uri ? hostDeUri(w.uri) : null;
    if (w.domain?.trim()) dominios.add(sinWww(w.domain.trim()));
    else if (PARECE_HOST.test(titulo)) dominios.add(sinWww(titulo));
    else if (host && !REDIRECCION_GOOGLE.test(host)) dominios.add(host);
  }
  return [...dominios];
}

/** Fuentes a mostrar (enlaces): uris http(s) únicas con su título. */
export function extraerFuentes(chunks: readonly ChunkWeb[] | undefined): FuenteBusqueda[] {
  const vistas = new Set<string>();
  const fuentes: FuenteBusqueda[] = [];
  for (const c of chunks ?? []) {
    const uri = c.web?.uri;
    const host = uri ? hostDeUri(uri) : null;
    if (!uri || !host || vistas.has(uri)) continue;
    vistas.add(uri);
    fuentes.push({ titulo: c.web?.title?.trim() || c.web?.domain?.trim() || host, uri });
  }
  return fuentes;
}

// ----------------------------------------------------------- enfriamiento

export type EstadoBusqueda = { puede: true } | { puede: false; desde: string };

/**
 * ¿Se puede lanzar otra búsqueda IA para esta capa y año? Enfriamiento de 24 h desde la última.
 * Una marca ilegible o situada en el futuro (reloj descuadrado) no bloquea: solo es una protección de coste.
 */
export function puedeBuscar(ultima: BusquedaIa | undefined, ahoraIso: string): EstadoBusqueda {
  if (!ultima) return { puede: true };
  const ultimaMs = Date.parse(ultima.ejecutadaAt);
  const ahoraMs = Date.parse(ahoraIso);
  if (Number.isNaN(ultimaMs) || Number.isNaN(ahoraMs) || ahoraMs < ultimaMs) return { puede: true };
  const hasta = ultimaMs + COOLDOWN_BUSQUEDA_HORAS * 3_600_000;
  return ahoraMs >= hasta ? { puede: true } : { puede: false, desde: new Date(hasta).toISOString() };
}
