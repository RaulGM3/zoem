import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FacturaExtractionService } from './factura-extraction.service';
import { AiService } from './ai.service';
import { IaCupoService } from '../planes/ia-cupo';
import { CupoIaAgotadoError } from '../agent/errores-ia';

interface FakeModel {
  generateContent: ReturnType<typeof vi.fn>;
}

const respuesta = (obj: unknown) => ({ response: { text: () => (typeof obj === 'string' ? obj : JSON.stringify(obj)) } });
const pdf = (bytes = 10) => new File([new Uint8Array(bytes)], 'f.pdf', { type: 'application/pdf' });

describe('FacturaExtractionService (AiService falso, sin red)', () => {
  let model: FakeModel;
  let getJsonModel: ReturnType<typeof vi.fn>;
  let svc: FacturaExtractionService;
  let reservar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reservar = vi.fn().mockResolvedValue(undefined);
    model = { generateContent: vi.fn() };
    getJsonModel = vi.fn().mockReturnValue(model);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: AiService, useValue: { getJsonModel } }, { provide: IaCupoService, useValue: { reservar } }],
    });
    svc = TestBed.inject(FacturaExtractionService);
  });

  it('reserva cupo de IA ANTES de llamar al modelo', async () => {
    const orden: string[] = [];
    reservar.mockImplementation(async () => { orden.push('reservar'); });
    model.generateContent.mockImplementation(async () => { orden.push('modelo'); return respuesta({ numero: 'F1' }); });
    await svc.extraer(pdf());
    expect(orden).toEqual(['reservar', 'modelo']);
  });

  it('sin cupo: no llama al modelo y explica el motivo', async () => {
    reservar.mockRejectedValue(new CupoIaAgotadoError());
    const r = await svc.extraer(pdf());
    expect(model.generateContent).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, mensaje: expect.stringMatching(/cupo mensual de ia/i) });
  });

  it('un archivo demasiado grande no gasta cupo', async () => {
    await svc.extraer(pdf(16 * 1024 * 1024));
    expect(reservar).not.toHaveBeenCalled();
  });

  it('OK: devuelve los datos normalizados para precargar el formulario', async () => {
    model.generateContent.mockResolvedValue(
      respuesta({
        proveedorNombre: ' Proveedor SL ',
        proveedorNif: 'b-12345674',
        numero: ' F-001 ',
        tipoFactura: 'F1',
        fechaExpedicion: '2026-04-02',
        lineasIva: [{ base: 100, tipo: 21, cuota: 21 }],
        total: 121,
        concepto: 'Material de oficina',
      }),
    );
    const r = await svc.extraer(pdf());
    expect(r).toEqual({
      ok: true,
      datos: {
        proveedorNombre: 'Proveedor SL',
        proveedorNif: 'B12345674',
        numero: 'F-001',
        tipoFactura: 'F1',
        fechaExpedicion: '2026-04-02',
        lineasIva: [{ base: 100, tipo: 21, cuota: 21 }],
        total: 121,
        concepto: 'Material de oficina',
      },
    });
  });

  it('envía el archivo en base64 con su mimeType y pide JSON estructurado', async () => {
    model.generateContent.mockResolvedValue(respuesta({ lineasIva: [] }));
    await svc.extraer(pdf());
    expect(getJsonModel).toHaveBeenCalledTimes(1);
    const parts = model.generateContent.mock.calls[0][0] as Array<Record<string, unknown>>;
    const inline = parts.find((p) => 'inlineData' in p) as { inlineData: { data: string; mimeType: string } };
    expect(inline.inlineData.mimeType).toBe('application/pdf');
    expect(inline.inlineData.data.length).toBeGreaterThan(0);
    expect(parts.some((p) => typeof p['text'] === 'string')).toBe(true);
  });

  it('convierte fechas dd/mm/aaaa a ISO y descarta las inválidas', async () => {
    model.generateContent.mockResolvedValue(respuesta({ fechaExpedicion: '02/04/2026', lineasIva: [] }));
    const a = await svc.extraer(pdf());
    expect(a.ok && a.datos.fechaExpedicion).toBe('2026-04-02');
    model.generateContent.mockResolvedValue(respuesta({ fechaExpedicion: '31/02/2026', lineasIva: [] }));
    const b = await svc.extraer(pdf());
    expect(b.ok && b.datos.fechaExpedicion).toBe('');
  });

  it('calcula la cuota si falta y el total si falta; redondea a 2 decimales', async () => {
    model.generateContent.mockResolvedValue(respuesta({ lineasIva: [{ base: 33.333, tipo: 21 }] }));
    const r = await svc.extraer(pdf());
    expect(r.ok && r.datos.lineasIva).toEqual([{ base: 33.33, tipo: 21, cuota: 7 }]);
    expect(r.ok && r.datos.total).toBe(40.33);
  });

  it('descarta líneas sin base numérica y tipoFactura desconocido pasa a F1', async () => {
    model.generateContent.mockResolvedValue(
      respuesta({ tipoFactura: 'R1', lineasIva: [{ tipo: 21 }, { base: 10, tipo: 10, cuota: 1 }] }),
    );
    const r = await svc.extraer(pdf());
    expect(r.ok && r.datos.lineasIva).toEqual([{ base: 10, tipo: 10, cuota: 1 }]);
    expect(r.ok && r.datos.tipoFactura).toBe('F1');
  });

  it('F2 se respeta', async () => {
    model.generateContent.mockResolvedValue(respuesta({ tipoFactura: 'F2', lineasIva: [] }));
    const r = await svc.extraer(pdf());
    expect(r.ok && r.datos.tipoFactura).toBe('F2');
  });

  it('fallo del modelo: ok=false con mensaje para abrir el formulario vacío', async () => {
    model.generateContent.mockRejectedValue(new Error('network'));
    const r = await svc.extraer(pdf());
    expect(r).toEqual({ ok: false, mensaje: expect.stringMatching(/rellena|manual/i) });
  });

  it('respuesta que no es JSON: ok=false', async () => {
    model.generateContent.mockResolvedValue(respuesta('esto no es json'));
    const r = await svc.extraer(pdf());
    expect(r.ok).toBe(false);
  });

  it('archivo demasiado grande: ok=false sin llamar al modelo', async () => {
    const r = await svc.extraer(pdf(15 * 1024 * 1024 + 1));
    expect(r.ok).toBe(false);
    expect(model.generateContent).not.toHaveBeenCalled();
  });
});
