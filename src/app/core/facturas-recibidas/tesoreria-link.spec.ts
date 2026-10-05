import { describe, it, expect } from 'vitest';
import {
  movimientoDesdeFactura,
  sugerirMovimientos,
  type FacturaParaMovimiento,
  type MovimientoCandidato,
} from './tesoreria-link';

const mov = (over: Partial<MovimientoCandidato> & { id: string }): MovimientoCandidato => ({
  tipo: 'gasto',
  esEntrada: false,
  importe: 121,
  fecha: '2026-04-03',
  concepto: 'Pago proveedor',
  ...over,
});
const FACT = { total: 121, fechaExpedicion: '2026-04-02' };

describe('sugerirMovimientos', () => {
  it('sugiere gastos sin vincular con importe ±0,01 y fecha a ≤ 7 días', () => {
    const r = sugerirMovimientos(FACT, [
      mov({ id: 'ok' }),
      mov({ id: 'centimo', importe: 121.01 }),
      mov({ id: 'importe', importe: 120 }),
      mov({ id: 'lejos', fecha: '2026-04-20' }),
      mov({ id: 'limite', fecha: '2026-04-09' }),
      mov({ id: 'fuera', fecha: '2026-04-10' }),
      mov({ id: 'antes', fecha: '2026-03-26' }),
    ]);
    expect(r.map((m) => m.id).sort()).toEqual(['antes', 'centimo', 'limite', 'ok']);
  });

  it('excluye ingresos, entradas, otros tipos y movimientos ya vinculados', () => {
    const r = sugerirMovimientos(FACT, [
      mov({ id: 'entrada', esEntrada: true }),
      mov({ id: 'ingreso', tipo: 'ingreso' }),
      mov({ id: 'vinculado', facturaRecibidaId: 'OTRA' }),
      mov({ id: 'ok' }),
    ]);
    expect(r.map((m) => m.id)).toEqual(['ok']);
  });

  it('ordena primero el más cercano en fecha y, a igualdad, el de importe más exacto', () => {
    const r = sugerirMovimientos(FACT, [
      mov({ id: 'lejano', fecha: '2026-04-08' }),
      mov({ id: 'mismoDia', fecha: '2026-04-02', importe: 121.01 }),
      mov({ id: 'mismoDiaExacto', fecha: '2026-04-02' }),
      mov({ id: 'cerca', fecha: '2026-04-03' }),
    ]);
    expect(r.map((m) => m.id)).toEqual(['mismoDiaExacto', 'mismoDia', 'cerca', 'lejano']);
  });

  it('sin fecha de expedición válida o sin candidatos devuelve lista vacía', () => {
    expect(sugerirMovimientos({ total: 121, fechaExpedicion: '' }, [mov({ id: 'a' })])).toEqual([]);
    expect(sugerirMovimientos(FACT, [])).toEqual([]);
  });

  it('un total no finito no sugiere nada', () => {
    expect(sugerirMovimientos({ total: Number.NaN, fechaExpedicion: '2026-04-02' }, [mov({ id: 'a' })])).toEqual([]);
  });
});

describe('movimientoDesdeFactura', () => {
  const base: FacturaParaMovimiento = {
    proveedor: { nombre: 'Proveedor SL' },
    numero: 'F-001',
    total: 121,
    fechaExpedicion: '2026-04-02',
    lineasIva: [{ base: 100, tipo: 21, cuota: 21 }],
  };

  it('crea un gasto con el total, salida, fecha de expedición y desglose fiscal', () => {
    expect(movimientoDesdeFactura(base, 'ID1')).toEqual({
      tipo: 'gasto',
      concepto: 'Proveedor SL · F-001',
      importe: 121,
      esEntrada: false,
      fecha: '2026-04-02',
      baseImponible: 100,
      cuotaIva: 21,
      tipoIva: 21,
      facturaRecibidaId: 'ID1',
    });
  });

  it('base + cuota == importe aunque el total difiera 1 céntimo de la suma', () => {
    const m = movimientoDesdeFactura({ ...base, total: 121.01 }, 'ID1');
    expect(m.baseImponible + m.cuotaIva).toBeCloseTo(121.01, 10);
  });

  it('con varios tipos no fija tipoIva y suma bases y cuotas', () => {
    const m = movimientoDesdeFactura(
      { ...base, total: 176, lineasIva: [{ base: 100, tipo: 21, cuota: 21 }, { base: 50, tipo: 10, cuota: 5 }] },
      'ID1',
    );
    expect(m.tipoIva).toBeUndefined();
    expect(m.cuotaIva).toBe(26);
    expect(m.baseImponible).toBe(150);
  });

  it('un tipo fuera de 21/10/4/0 no se informa como tipoIva', () => {
    const m = movimientoDesdeFactura({ ...base, total: 105, lineasIva: [{ base: 100, tipo: 5, cuota: 5 }] }, 'ID1');
    expect(m.tipoIva).toBeUndefined();
  });

  it('todas las líneas exentas: ivaExento, tipo 0 y sin cuota', () => {
    const m = movimientoDesdeFactura(
      { ...base, total: 80, lineasIva: [{ base: 80, tipo: 0, cuota: 0, exento: true, causaExencion: 'E1' }] },
      'ID1',
    );
    expect(m).toMatchObject({ ivaExento: true, tipoIva: 0, cuotaIva: 0, baseImponible: 80, importe: 80 });
  });
});
