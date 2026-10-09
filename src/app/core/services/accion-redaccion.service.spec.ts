import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AccionRedaccionService } from './accion-redaccion.service';
import { AiService } from './ai.service';
import { IaCupoService } from '../planes/ia-cupo';
import { CupoIaAgotadoError } from '../agent/errores-ia';

const respuesta = (obj: unknown) => ({ response: { text: () => (typeof obj === 'string' ? obj : JSON.stringify(obj)) } });

describe('AccionRedaccionService (AiService falso, sin red)', () => {
  let generateContent: ReturnType<typeof vi.fn>;
  let getJsonModel: ReturnType<typeof vi.fn>;
  let svc: AccionRedaccionService;
  let reservar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reservar = vi.fn().mockResolvedValue(undefined);
    generateContent = vi.fn();
    getJsonModel = vi.fn().mockReturnValue({ generateContent });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: AiService, useValue: { getJsonModel } }, { provide: IaCupoService, useValue: { reservar } }],
    });
    svc = TestBed.inject(AccionRedaccionService);
  });

  it('OK: devuelve asunto y cuerpo normalizados', async () => {
    generateContent.mockResolvedValue(respuesta({ asunto: ' Documentación ', cuerpo: 'Hola {{cliente}}' }));
    const r = await svc.redactar({ modo: 'plantilla', formato: 'email', instrucciones: 'pedir DNI' });
    expect(r).toEqual({ ok: true, texto: { asunto: 'Documentación', cuerpo: 'Hola {{cliente}}' } });
    expect(getJsonModel).toHaveBeenCalledTimes(1);
    expect(String(generateContent.mock.calls[0][0])).toContain('pedir DNI');
  });

  it('reserva cupo de IA ANTES de llamar al modelo', async () => {
    const orden: string[] = [];
    reservar.mockImplementation(async () => { orden.push('reservar'); });
    generateContent.mockImplementation(async () => { orden.push('modelo'); return respuesta({ asunto: 'A', cuerpo: 'B' }); });
    await svc.redactar({ modo: 'plantilla', formato: 'email', instrucciones: 'pedir DNI' });
    expect(orden).toEqual(['reservar', 'modelo']);
  });

  it('sin cupo: no llama al modelo y explica el motivo', async () => {
    reservar.mockRejectedValue(new CupoIaAgotadoError());
    const r = await svc.redactar({ modo: 'plantilla', formato: 'email', instrucciones: 'pedir DNI' });
    expect(generateContent).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, mensaje: expect.stringMatching(/cupo mensual de ia/i) });
  });

  it('instrucciones vacías: no gasta cupo ni llama a Gemini', async () => {
    await svc.redactar({ modo: 'plantilla', formato: 'email', instrucciones: '  ' });
    expect(reservar).not.toHaveBeenCalled();
  });

  it('instrucciones vacías: no llama a Gemini', async () => {
    const r = await svc.redactar({ modo: 'plantilla', formato: 'email', instrucciones: '   ' });
    expect(r.ok).toBe(false);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('nunca lanza: error de red o JSON inválido devuelve ok:false', async () => {
    generateContent.mockRejectedValue(new Error('red'));
    expect((await svc.redactar({ modo: 'plantilla', formato: 'email', instrucciones: 'x' })).ok).toBe(false);
    generateContent.mockResolvedValue(respuesta('no-json'));
    expect((await svc.redactar({ modo: 'plantilla', formato: 'email', instrucciones: 'x' })).ok).toBe(false);
    generateContent.mockResolvedValue(respuesta({ asunto: 'A', cuerpo: '' }));
    expect((await svc.redactar({ modo: 'plantilla', formato: 'email', instrucciones: 'x' })).ok).toBe(false);
  });
});
