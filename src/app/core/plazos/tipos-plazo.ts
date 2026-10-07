import type { Jurisdiccion } from './calendario-judicial';
import type { UnidadPlazo } from './computo-plazo';

export interface TipoPlazo {
  id: string;
  etiqueta: string;
  cantidad: number;
  unidad: UnidadPlazo;
  jurisdiccion: Jurisdiccion;
}

/**
 * Catálogo de plazos frecuentes. Es SOLO una sugerencia editable: el abogado siempre puede
 * ajustar cantidad, unidad y jurisdicción antes de calcular.
 */
export const TIPOS_PLAZO: readonly TipoPlazo[] = [
  { id: 'contestacion-verbal', etiqueta: 'Contestación a la demanda (juicio verbal)', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil' },
  { id: 'contestacion-ordinario', etiqueta: 'Contestación a la demanda (juicio ordinario)', cantidad: 20, unidad: 'dias', jurisdiccion: 'civil' },
  { id: 'apelacion-civil', etiqueta: 'Recurso de apelación, interposición (art. 458 LEC)', cantidad: 20, unidad: 'dias', jurisdiccion: 'civil' },
  { id: 'reposicion', etiqueta: 'Recurso de reposición', cantidad: 5, unidad: 'dias', jurisdiccion: 'civil' },
  { id: 'casacion-civil', etiqueta: 'Recurso de casación', cantidad: 20, unidad: 'dias', jurisdiccion: 'civil' },
  { id: 'oposicion-ejecucion', etiqueta: 'Oposición a la ejecución', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil' },
  { id: 'contestacion-apelacion', etiqueta: 'Contestación al recurso de apelación', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil' },
  { id: 'recurso-contencioso', etiqueta: 'Recurso contencioso-administrativo', cantidad: 2, unidad: 'meses', jurisdiccion: 'contencioso' },
  { id: 'suplicacion-anuncio', etiqueta: 'Recurso de suplicación, anuncio', cantidad: 5, unidad: 'dias', jurisdiccion: 'laboral' },
  { id: 'apelacion-penal-abreviado', etiqueta: 'Recurso de apelación (procedimiento abreviado)', cantidad: 10, unidad: 'dias', jurisdiccion: 'penal' },
];
