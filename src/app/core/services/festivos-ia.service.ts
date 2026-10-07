import { inject, Injectable } from '@angular/core';
import { Schema } from 'firebase/ai';
import type { GenerateContentResult } from 'firebase/ai';
import { conReintento, mensajeDeError } from '../agent/errores-ia';
import {
  fusionarPropuestas, idCapaAutonomica, idCapaPartido,
  type CapaAnio, type MotivoDescarte,
} from '../plazos/dias-rojos';
import {
  construirPrompt, extraerDominios, extraerFuentes, parsearPropuestas,
  type CapaBusqueda, type FuenteBusqueda,
} from '../plazos/festivos-ia';
import { AiService } from './ai.service';
import { CalendariosJudicialesService } from './calendarios-judiciales.service';

/**
 * Estrategia de la búsqueda con Google Search:
 * - 'una_llamada': un único `generateContent` con `tools: googleSearch` + `responseSchema` (Gemini 3+ lo permite).
 * - 'dos_llamadas' (plan B): 1) búsqueda con grounding que devuelve texto; 2) llamada con esquema JSON que
 *   estructura ese texto. Cambiar a esta si el backend Vertex `eu` rechazara tools + schema en ejecución
 *   (no se pudo probar en desarrollo). Coste: el doble de llamadas.
 */
export type EstrategiaFestivos = 'una_llamada' | 'dos_llamadas';
export const ESTRATEGIA_FESTIVOS: EstrategiaFestivos = 'una_llamada';

export interface BusquedaFestivosOk {
  ok: true;
  capaId: string;
  /** Capa ya fusionada (todo lo nuevo entra como `propuesto`); falta persistirla con `guardarFusion`. */
  capa: CapaAnio;
  añadidos: number;
  descartadas: { fecha: string; motivo: MotivoDescarte }[];
  /** HTML de las sugerencias de Google Search: HAY que mostrarlo (términos del grounding). */
  searchEntryPointHtml?: string;
  fuentes: FuenteBusqueda[];
}
export type ResultadoBusquedaFestivos = BusquedaFestivosOk | { ok: false; mensaje: string };

const SCHEMA = Schema.object({
  properties: {
    festivos: Schema.array({
      items: Schema.object({
        properties: {
          fecha: Schema.string(),
          nombre: Schema.string(),
          ambito: Schema.enumString({ enum: ['nacional', 'autonomico', 'local'] }),
          fuenteUrl: Schema.string(),
        },
      }),
    }),
  },
});

const MSG_ILEGIBLE = 'No se pudo leer la respuesta de la búsqueda. Inténtalo de nuevo en un momento.';
const MSG_CAPA = 'No se pudo comprobar el calendario actual. Revisa tu conexión e inténtalo de nuevo.';

class RespuestaIlegible extends Error {}

const PROMPT_ESTRUCTURAR = (texto: string, anio: number): string =>
  `Convierte el siguiente texto en JSON con la lista "festivos" del año ${anio}. Cada elemento: "fecha" (aaaa-mm-dd), ` +
  `"nombre", "ambito" ("nacional", "autonomico" o "local") y "fuenteUrl" (URL de la fuente oficial citada en el texto). ` +
  `Incluye SOLO fechas que tengan fuente oficial en el texto; no inventes nada.\n\nTEXTO:\n${texto}`;

/**
 * Búsqueda MANUAL de festivos oficiales con Gemini + Google Search. No guarda nada: devuelve la fusión
 * propuesta para que el llamador la persista. Todo lo que entra es `propuesto` (nunca cuenta en un
 * cómputo hasta que un humano lo confirma).
 */
@Injectable({ providedIn: 'root' })
export class FestivosIaService {
  private readonly ai = inject(AiService);
  private readonly calendarios = inject(CalendariosJudicialesService);

  async buscar(
    capa: CapaBusqueda,
    anio: number,
    estrategia: EstrategiaFestivos = ESTRATEGIA_FESTIVOS,
  ): Promise<ResultadoBusquedaFestivos> {
    const capaId = capa.tipo === 'autonomica' ? idCapaAutonomica(capa.ca) : idCapaPartido(capa.partidoId);
    let actual: CapaAnio;
    try {
      actual = (await this.calendarios.obtenerCapa(capaId, anio)) ?? { diasRojos: [], descartados: [] };
    } catch {
      return { ok: false, mensaje: MSG_CAPA };
    }

    try {
      const prompt = construirPrompt(capa, anio);
      const { json, grounding } = await conReintento(() => this.consultar(prompt, anio, estrategia));
      const crudo: unknown = JSON.parse(json);
      const chunks = grounding?.groundingChunks;
      const fusion = fusionarPropuestas(actual, parsearPropuestas(crudo, capa.tipo), anio, extraerDominios(chunks));
      return {
        ok: true,
        capaId,
        capa: fusion.capa,
        añadidos: fusion.añadidos,
        descartadas: fusion.descartadas,
        searchEntryPointHtml: grounding?.searchEntryPoint?.renderedContent || undefined,
        fuentes: extraerFuentes(chunks),
      };
    } catch (e) {
      if (e instanceof SyntaxError || e instanceof RespuestaIlegible) return { ok: false, mensaje: MSG_ILEGIBLE };
      console.error('[FestivosIaService] búsqueda fallida', e);
      return { ok: false, mensaje: mensajeDeError(e) };
    }
  }

  private async consultar(prompt: string, anio: number, estrategia: EstrategiaFestivos) {
    if (estrategia === 'una_llamada') {
      const r = await this.ai.getGroundedJsonModel(SCHEMA).generateContent(prompt);
      return { json: r.response.text(), grounding: grounding(r) };
    }
    const busqueda = await this.ai.getGroundedTextModel().generateContent(prompt);
    const texto = busqueda.response.text();
    if (!texto.trim()) throw new RespuestaIlegible();
    const estructurado = await this.ai.getJsonModel(SCHEMA).generateContent(PROMPT_ESTRUCTURAR(texto, anio));
    return { json: estructurado.response.text(), grounding: grounding(busqueda) };
  }
}

const grounding = (r: GenerateContentResult) => r.response.candidates?.[0]?.groundingMetadata;
