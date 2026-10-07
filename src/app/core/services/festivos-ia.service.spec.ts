import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AiService } from './ai.service';
import { CalendariosJudicialesService } from './calendarios-judiciales.service';
import { FestivosIaService } from './festivos-ia.service';
import type { CapaAnio } from '../plazos/dias-rojos';

const grounding = {
  searchEntryPoint: { renderedContent: '<div class="chip">Google</div>' },
  groundingChunks: [
    { web: { uri: 'https://vertexaisearch.cloud.google.com/r/1', title: 'boe.es', domain: 'boe.es' } },
    { web: { uri: 'https://vertexaisearch.cloud.google.com/r/2', title: 'bocm.es', domain: 'bocm.es' } },
  ],
};
const json = {
  festivos: [
    { fecha: '2026-10-12', nombre: 'Fiesta Nacional de España', ambito: 'nacional', fuenteUrl: 'https://www.boe.es/diario_boe/x' },
    { fecha: '2026-05-02', nombre: 'Día de la Comunidad', ambito: 'autonomico', fuenteUrl: 'https://www.bocm.es/y' },
    { fecha: '2026-11-09', nombre: 'Sin fuente', ambito: 'autonomico' },
    { fecha: '2026-12-08', nombre: 'Fuente de blog', ambito: 'nacional', fuenteUrl: 'https://blogcualquiera.com/z' },
  ],
};
const respuesta = (texto: string, groundingMetadata: unknown = grounding) => ({
  response: { text: () => texto, candidates: [{ groundingMetadata }] },
});
const vacia: CapaAnio = { diasRojos: [], descartados: ['2026-12-25'] };

describe('FestivosIaService (AiService falso, sin red)', () => {
  let grounded: { generateContent: ReturnType<typeof vi.fn> };
  let estructurador: { generateContent: ReturnType<typeof vi.fn> };
  let ai: { getGroundedJsonModel: ReturnType<typeof vi.fn>; getGroundedTextModel: ReturnType<typeof vi.fn>; getJsonModel: ReturnType<typeof vi.fn> };
  let obtenerCapa: ReturnType<typeof vi.fn>;
  let svc: FestivosIaService;

  beforeEach(() => {
    grounded = { generateContent: vi.fn() };
    estructurador = { generateContent: vi.fn() };
    ai = {
      getGroundedJsonModel: vi.fn().mockReturnValue(grounded),
      getGroundedTextModel: vi.fn().mockReturnValue(grounded),
      getJsonModel: vi.fn().mockReturnValue(estructurador),
    };
    obtenerCapa = vi.fn().mockResolvedValue(vacia);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AiService, useValue: ai },
        { provide: CalendariosJudicialesService, useValue: { obtenerCapa } },
      ],
    });
    svc = TestBed.inject(FestivosIaService);
  });

  it('una llamada: fusiona, descarta lo que no tiene fuente oficial y devuelve fuentes y sugerencias de Google', async () => {
    grounded.generateContent.mockResolvedValue(respuesta(JSON.stringify(json)));
    const r = await svc.buscar({ tipo: 'autonomica', ca: 'madrid' }, 2026, 'una_llamada');
    if (!r.ok) throw new Error(r.mensaje);
    expect(r.capaId).toBe('ca-madrid');
    expect(r.añadidos).toBe(2);
    expect(r.capa.diasRojos.map((d) => d.fecha).sort()).toEqual(['2026-05-02', '2026-10-12']);
    expect(r.capa.diasRojos.every((d) => d.estado === 'propuesto' && d.origen === 'ia')).toBe(true);
    expect(r.capa.descartados).toEqual(['2026-12-25']);
    expect(r.descartadas).toEqual([
      { fecha: '2026-11-09', motivo: 'sin_fuente' },
      { fecha: '2026-12-08', motivo: 'dominio_no_oficial' },
    ]);
    expect(r.searchEntryPointHtml).toBe('<div class="chip">Google</div>');
    expect(r.fuentes).toEqual([
      { titulo: 'boe.es', uri: 'https://vertexaisearch.cloud.google.com/r/1' },
      { titulo: 'bocm.es', uri: 'https://vertexaisearch.cloud.google.com/r/2' },
    ]);
    expect(ai.getGroundedJsonModel).toHaveBeenCalledTimes(1);
    expect(ai.getJsonModel).not.toHaveBeenCalled();
    expect(obtenerCapa).toHaveBeenCalledWith('ca-madrid', 2026);
    expect(JSON.stringify(grounded.generateContent.mock.calls[0])).toContain('Comunidad de Madrid');
  });

  it('descarta una fuente oficial cuyo dominio no apareció en la búsqueda (dominio_fuera_de_busqueda)', async () => {
    grounded.generateContent.mockResolvedValue(respuesta(JSON.stringify(json), {
      groundingChunks: [{ web: { uri: 'https://x', title: 'boe.es', domain: 'boe.es' } }],
    }));
    const r = await svc.buscar({ tipo: 'autonomica', ca: 'madrid' }, 2026, 'una_llamada');
    if (!r.ok) throw new Error(r.mensaje);
    expect(r.descartadas).toContainEqual({ fecha: '2026-05-02', motivo: 'dominio_fuera_de_busqueda' });
    expect(r.searchEntryPointHtml).toBeUndefined();
  });

  it('capa de partido: id pj-… y prompt con el municipio', async () => {
    grounded.generateContent.mockResolvedValue(respuesta(JSON.stringify({ festivos: [] })));
    const r = await svc.buscar({ tipo: 'partido', partidoId: '28-21' }, 2026, 'una_llamada');
    if (!r.ok) throw new Error(r.mensaje);
    expect(r.capaId).toBe('pj-28-21');
    expect(r.añadidos).toBe(0);
    expect(JSON.stringify(grounded.generateContent.mock.calls[0])).toMatch(/fiestas locales/i);
  });

  it('dos llamadas (plan B): la búsqueda devuelve texto y una segunda llamada lo estructura; el grounding sale de la primera', async () => {
    grounded.generateContent.mockResolvedValue(respuesta('Texto con festivos y fuentes'));
    estructurador.generateContent.mockResolvedValue(respuesta(JSON.stringify(json), undefined));
    const r = await svc.buscar({ tipo: 'autonomica', ca: 'madrid' }, 2026, 'dos_llamadas');
    if (!r.ok) throw new Error(r.mensaje);
    expect(ai.getGroundedTextModel).toHaveBeenCalledTimes(1);
    expect(ai.getJsonModel).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(estructurador.generateContent.mock.calls[0])).toContain('Texto con festivos y fuentes');
    expect(r.añadidos).toBe(2);
    expect(r.searchEntryPointHtml).toBe('<div class="chip">Google</div>');
  });

  it('error del modelo: mensaje amigable sin filtrar detalles', async () => {
    grounded.generateContent.mockRejectedValue(new Error('https://firebasevertexai.googleapis.com/proyecto-secreto (AI/fetch-error)'));
    const r = await svc.buscar({ tipo: 'autonomica', ca: 'madrid' }, 2026, 'una_llamada');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.mensaje).toContain('asistente');
    expect(r.mensaje).not.toContain('proyecto-secreto');
  });

  it('respuesta que no es JSON: error legible y no guarda nada', async () => {
    grounded.generateContent.mockResolvedValue(respuesta('esto no es json'));
    const r = await svc.buscar({ tipo: 'autonomica', ca: 'madrid' }, 2026, 'una_llamada');
    expect(r).toEqual({ ok: false, mensaje: expect.stringContaining('No se pudo leer') });
  });

  it('falla al leer la capa actual: error amigable, sin llamar a la IA', async () => {
    obtenerCapa.mockRejectedValue(new Error('permission-denied'));
    const r = await svc.buscar({ tipo: 'autonomica', ca: 'madrid' }, 2026, 'una_llamada');
    expect(r.ok).toBe(false);
    expect(grounded.generateContent).not.toHaveBeenCalled();
  });
});
