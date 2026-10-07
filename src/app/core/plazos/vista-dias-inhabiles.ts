import { CA_LABELS, type ComunidadAutonoma } from '../../interfaces/company';
import { diaSemana } from './fechas-iso';
import { idCapaAutonomica, idCapaPartido } from './dias-rojos';
import type { AmbitoDiaRojo, CapaAnio, DiaRojo, MotivoDescarte } from './dias-rojos';
import { partidoPorId } from './partidos-judiciales';

/** Lógica pura de la vista "Días inhábiles" de Configuración. */

export const AMBITO_LABEL: Record<AmbitoDiaRojo, string> = {
  nacional: 'Nacional',
  autonomico: 'Autonómico',
  local: 'Local',
  personalizado: 'Personalizado',
};

const ORDEN_AMBITOS: readonly AmbitoDiaRojo[] = ['nacional', 'autonomico', 'local', 'personalizado'];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export interface GrupoAmbito {
  ambito: AmbitoDiaRojo;
  label: string;
  dias: DiaRojo[];
}

export interface CapaVista {
  id: string;
  etiqueta: string;
}

/** '2026-01-01' -> '01/01/2026 · jueves'. */
export const fechaConDiaSemana = (iso: string): string =>
  `${iso.split('-').reverse().join('/')} · ${DIAS_SEMANA[diaSemana(iso)]}`;

export function agruparPorAmbito(dias: readonly DiaRojo[]): GrupoAmbito[] {
  return ORDEN_AMBITOS.flatMap((ambito) => {
    const delAmbito = dias.filter((d) => d.ambito === ambito).sort((a, b) => a.fecha.localeCompare(b.fecha));
    return delAmbito.length ? [{ ambito, label: AMBITO_LABEL[ambito], dias: delAmbito }] : [];
  });
}

export const hayConfirmados = (capa: CapaAnio | undefined): boolean =>
  (capa?.diasRojos ?? []).some((d) => d.estado === 'confirmado');

const etiquetaCa = (ca: ComunidadAutonoma): string => `${CA_LABELS[ca]} (autonómica)`;

/**
 * Capas editables: la CA de la empresa y, por cada partido judicial presente en los casos,
 * la capa del partido y la de su comunidad autónoma (si no está ya).
 */
export function capasEnUso(
  casos: readonly { partidoJudicialId?: string }[],
  caEmpresa: ComunidadAutonoma | undefined,
): CapaVista[] {
  const capas = new Map<string, string>();
  if (caEmpresa) capas.set(idCapaAutonomica(caEmpresa), etiquetaCa(caEmpresa));
  const partidos = new Set(casos.flatMap((c) => (c.partidoJudicialId ? [c.partidoJudicialId] : [])));
  for (const id of partidos) {
    const partido = partidoPorId(id);
    if (!partido) continue;
    capas.set(idCapaPartido(partido.id), `Partido judicial de ${partido.nombre} (${partido.provincia})`);
    const idCa = idCapaAutonomica(partido.ca);
    if (!capas.has(idCa)) capas.set(idCa, etiquetaCa(partido.ca));
  }
  return [...capas].map(([id, etiqueta]) => ({ id, etiqueta }));
}

/** Por qué la fusión descartó una fecha propuesta por la IA, en lenguaje del usuario. */
export function textoDescarte(motivo: MotivoDescarte, anio: number): string {
  switch (motivo) {
    case 'sin_fuente': return 'No indicaba una fuente oficial.';
    case 'dominio_no_oficial': return 'La fuente no es un sitio oficial (BOE o boletín oficial).';
    case 'dominio_fuera_de_busqueda': return 'La fuente no aparece entre las páginas que consultó la búsqueda.';
    case 'otro_anio': return `No es una fecha de ${anio}.`;
    case 'descartado_por_usuario': return 'Ya la quitaste antes y no se vuelve a proponer.';
    case 'ya_existe': return 'Ya estaba registrada (confirmada o añadida a mano).';
    case 'duplicada': return 'Aparecía repetida en la respuesta.';
  }
}
