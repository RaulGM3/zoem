import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import * as XLSX from 'xlsx';
import { LibroRecibidasExportService } from './libro-recibidas-export.service';
import type { FacturaParaLibro } from '../facturas-recibidas/libro-recibidas';

const f = (over: Partial<FacturaParaLibro> = {}): FacturaParaLibro => ({
  id: 'ID1',
  estado: 'registrada',
  numeroRecepcion: 1,
  tipoFactura: 'F1',
  proveedor: { nombre: 'Proveedor SL', nif: 'B12345674' },
  numero: 'F-001',
  fechaExpedicion: '2026-04-02',
  fechaRegistro: '2026-04-05',
  periodo303: { ejercicio: 2026, trimestre: 2 },
  lineasIva: [{ base: 100, tipo: 21, cuota: 21 }, { base: 50, tipo: 10, cuota: 5 }],
  porcentajeDeducible: 100,
  ...over,
});
const EMPRESA = { nif: 'B12345674', nombre: 'Mi Empresa SL' };
const P2 = { ejercicio: 2026, trimestre: 2 } as const;

describe('LibroRecibidasExportService', () => {
  let service: LibroRecibidasExportService;
  beforeEach(() => {
    TestBed.resetTestingModule();
    service = TestBed.inject(LibroRecibidasExportService);
  });

  it('trimestre vacío: no genera archivo', async () => {
    expect(await service.generar([f({ estado: 'anulada' })], P2, EMPRESA)).toBeNull();
  });

  it('nombre de archivo según la plantilla y una fila por tipo de IVA', async () => {
    const r = (await service.generar([f()], P2, EMPRESA))!;
    expect(r.nombreArchivo).toBe('2026B12345674RMi Empresa SL.xlsx');
    expect(r.filas).toBe(2);
  });

  it('el xlsx replica la plantilla: metadatos, cabecera de 4 filas, datos desde la fila 11', async () => {
    const r = (await service.generar([f()], P2, EMPRESA))!;
    const wb = XLSX.read(r.datos, { type: 'array' });
    expect(wb.SheetNames).toEqual(['RECIBIDAS_GASTOS']);
    const ws = wb.Sheets['RECIBIDAS_GASTOS'];
    expect(ws['I2'].v).toBe('Ejercicio: 2026');
    expect(ws['I3'].v).toBe('NIF: B12345674');
    expect(ws['I5'].v).toBe('NOMBRE O RAZÓN SOCIAL: Mi Empresa SL');
    expect(ws['J1'].v).toContain('2026B12345674RMi Empresa SL');
    expect(ws['A7'].v).toBe('Autoliquidación(12)');
    expect(ws['Z7'].v).toBe('Total Factura');
    expect(ws['A9'].v).toBe('Decimal (4,0)');
    expect(ws['A11'].v).toBe(2026);
    expect(ws['A12'].v).toBe(2026);
    expect(ws['A13']).toBeUndefined();
    expect(XLSX.utils.decode_range(ws['!ref']!).e.c).toBe(41);
    expect(ws['!merges']?.map((m) => XLSX.utils.encode_range(m))).toContain('Z7:Z8');
  });

  it('importes y tipos son numéricos con formato 0.00; fechas y números de recepción, texto', async () => {
    const r = (await service.generar([f()], P2, EMPRESA))!;
    const ws = XLSX.read(r.datos, { type: 'array', cellNF: true }).Sheets['RECIBIDAS_GASTOS'];
    for (const c of ['Z11', 'AA11', 'AB11', 'AC11', 'AD11']) {
      expect(ws[c].t, c).toBe('n');
      expect(ws[c].z, c).toBe('0.00');
    }
    expect(ws['Z11'].v).toBe(121);
    expect(ws['Z12'].v).toBe(55);
    expect(ws['I11'].t).toBe('s');
    expect(ws['I11'].v).toBe('02/04/2026');
    expect(ws['N11'].t).toBe('s');
    expect(ws['R11'].v).toBe('B12345674');
  });

  it('exportar descarga el archivo con su nombre', async () => {
    const click = vi.fn();
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor);
    const crear = vi.fn().mockReturnValue('blob:x');
    const revocar = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar }));
    const ok = await service.exportar([f()], P2, EMPRESA);
    expect(ok).toBe(true);
    expect(anchor.download).toBe('2026B12345674RMi Empresa SL.xlsx');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revocar).toHaveBeenCalledWith('blob:x');
    vi.restoreAllMocks();
  });

  it('exportar con trimestre vacío no descarga y devuelve false', async () => {
    expect(await service.exportar([], P2, EMPRESA)).toBe(false);
  });
});
