import { describe, it, expect } from 'vitest';
import {
  FILTRO_MOVIMIENTOS_VACIO,
  ORDEN_MOVIMIENTOS_DEFECTO,
  filtrarMovimientos,
  ordenarMovimientos,
  filtrarYOrdenar,
  hayFiltroActivo,
  contarPorTipo,
  type FiltroMovimientos,
  type MovimientoFiltrable,
} from './filtro-movimientos';

/** Factory mínima para construir movimientos de prueba sin ruido. */
function mov(p: Partial<MovimientoFiltrable> = {}): MovimientoFiltrable {
  return {
    tipo: 'gasto',
    concepto: 'Movimiento',
    notas: undefined,
    importe: 100,
    esEntrada: false,
    fecha: '2026-06-15',
    cuentaId: undefined,
    ...p,
  };
}

function filtro(p: Partial<FiltroMovimientos> = {}): FiltroMovimientos {
  return { ...FILTRO_MOVIMIENTOS_VACIO, ...p };
}

describe('filtrarMovimientos — texto', () => {
  it('sin filtros devuelve todos los movimientos', () => {
    const movs = [mov({ concepto: 'A' }), mov({ concepto: 'B' })];
    expect(filtrarMovimientos(movs, FILTRO_MOVIMIENTOS_VACIO)).toHaveLength(2);
  });

  it('busca en el concepto sin distinguir mayúsculas', () => {
    const movs = [mov({ concepto: 'Tasa judicial' }), mov({ concepto: 'Notaría' })];
    expect(filtrarMovimientos(movs, filtro({ texto: 'TASA' }))).toEqual([movs[0]]);
  });

  it('busca también en las notas', () => {
    const movs = [mov({ concepto: 'Pago', notas: 'factura 2026-114' }), mov({ concepto: 'Pago' })];
    expect(filtrarMovimientos(movs, filtro({ texto: '2026-114' }))).toEqual([movs[0]]);
  });

  it('ignora acentos en ambos sentidos', () => {
    const movs = [mov({ concepto: 'Notaría' })];
    expect(filtrarMovimientos(movs, filtro({ texto: 'notaria' }))).toEqual(movs);
    expect(filtrarMovimientos([mov({ concepto: 'Notaria' })], filtro({ texto: 'notaría' }))).toHaveLength(1);
  });

  it('el texto en blanco no filtra nada', () => {
    const movs = [mov(), mov()];
    expect(filtrarMovimientos(movs, filtro({ texto: '   ' }))).toHaveLength(2);
  });
});

describe('filtrarMovimientos — tipo, dirección y cuenta', () => {
  it('lista de tipos vacía significa "todos los tipos"', () => {
    const movs = [mov({ tipo: 'gasto' }), mov({ tipo: 'suplido' })];
    expect(filtrarMovimientos(movs, filtro({ tipos: [] }))).toHaveLength(2);
  });

  it('filtra por los tipos seleccionados (OR entre ellos)', () => {
    const movs = [mov({ tipo: 'gasto' }), mov({ tipo: 'suplido' }), mov({ tipo: 'honorario' })];
    const out = filtrarMovimientos(movs, filtro({ tipos: ['gasto', 'honorario'] }));
    expect(out.map(m => m.tipo)).toEqual(['gasto', 'honorario']);
  });

  it('filtra por dirección entradas / salidas', () => {
    const movs = [mov({ esEntrada: true }), mov({ esEntrada: false })];
    expect(filtrarMovimientos(movs, filtro({ direccion: 'entradas' }))).toEqual([movs[0]]);
    expect(filtrarMovimientos(movs, filtro({ direccion: 'salidas' }))).toEqual([movs[1]]);
    expect(filtrarMovimientos(movs, filtro({ direccion: 'todas' }))).toHaveLength(2);
  });

  it('filtra por cuenta y trata los movimientos sin cuenta como "sin-cuenta"', () => {
    const movs = [mov({ cuentaId: 'c1' }), mov({ cuentaId: 'c2' }), mov({ cuentaId: undefined })];
    expect(filtrarMovimientos(movs, filtro({ cuentaIds: ['c1'] }))).toEqual([movs[0]]);
    expect(filtrarMovimientos(movs, filtro({ cuentaIds: ['sin-cuenta'] }))).toEqual([movs[2]]);
  });

  it('combina filtros con AND', () => {
    const movs = [
      mov({ tipo: 'gasto', esEntrada: false, concepto: 'Tasa' }),
      mov({ tipo: 'gasto', esEntrada: true, concepto: 'Tasa' }),
      mov({ tipo: 'suplido', esEntrada: false, concepto: 'Tasa' }),
    ];
    const out = filtrarMovimientos(movs, filtro({ tipos: ['gasto'], direccion: 'salidas', texto: 'tasa' }));
    expect(out).toEqual([movs[0]]);
  });
});

describe('filtrarMovimientos — rango de fechas', () => {
  const movs = [
    mov({ fecha: '2026-01-10' }),
    mov({ fecha: '2026-06-15' }),
    mov({ fecha: '2026-12-31' }),
  ];

  it('desde es inclusivo', () => {
    expect(filtrarMovimientos(movs, filtro({ desde: '2026-06-15' }))).toEqual([movs[1], movs[2]]);
  });

  it('hasta es inclusivo', () => {
    expect(filtrarMovimientos(movs, filtro({ hasta: '2026-06-15' }))).toEqual([movs[0], movs[1]]);
  });

  it('desde y hasta acotan por ambos extremos', () => {
    expect(filtrarMovimientos(movs, filtro({ desde: '2026-02-01', hasta: '2026-11-30' }))).toEqual([movs[1]]);
  });

  it('un rango imposible no devuelve nada', () => {
    expect(filtrarMovimientos(movs, filtro({ desde: '2026-12-01', hasta: '2026-01-01' }))).toEqual([]);
  });
});

describe('ordenarMovimientos', () => {
  it('no muta el array de entrada', () => {
    const movs = [mov({ fecha: '2026-01-01' }), mov({ fecha: '2026-09-09' })];
    const copia = [...movs];
    ordenarMovimientos(movs, { campo: 'fecha', direccion: 'asc' });
    expect(movs).toEqual(copia);
  });

  it('ordena por fecha descendente por defecto', () => {
    const movs = [mov({ fecha: '2026-01-01' }), mov({ fecha: '2026-09-09' }), mov({ fecha: '2026-05-05' })];
    const out = ordenarMovimientos(movs, ORDEN_MOVIMIENTOS_DEFECTO);
    expect(out.map(m => m.fecha)).toEqual(['2026-09-09', '2026-05-05', '2026-01-01']);
  });

  it('ordena por importe ascendente', () => {
    const movs = [mov({ importe: 300 }), mov({ importe: 50 }), mov({ importe: 120 })];
    const out = ordenarMovimientos(movs, { campo: 'importe', direccion: 'asc' });
    expect(out.map(m => m.importe)).toEqual([50, 120, 300]);
  });

  it('ordena por concepto alfabéticamente ignorando acentos y mayúsculas', () => {
    const movs = [mov({ concepto: 'Ñandú' }), mov({ concepto: 'ábaco' }), mov({ concepto: 'Zurdo' })];
    const out = ordenarMovimientos(movs, { campo: 'concepto', direccion: 'asc' });
    expect(out.map(m => m.concepto)).toEqual(['ábaco', 'Ñandú', 'Zurdo']);
  });

  it('ordena por tipo y desempata por fecha descendente', () => {
    const movs = [
      mov({ tipo: 'suplido', fecha: '2026-01-01' }),
      mov({ tipo: 'gasto', fecha: '2026-01-01' }),
      mov({ tipo: 'gasto', fecha: '2026-08-08' }),
    ];
    const out = ordenarMovimientos(movs, { campo: 'tipo', direccion: 'asc' });
    expect(out.map(m => [m.tipo, m.fecha])).toEqual([
      ['gasto', '2026-08-08'],
      ['gasto', '2026-01-01'],
      ['suplido', '2026-01-01'],
    ]);
  });
});

describe('filtrarYOrdenar', () => {
  it('aplica primero el filtro y después el orden', () => {
    const movs = [
      mov({ tipo: 'gasto', importe: 300 }),
      mov({ tipo: 'suplido', importe: 999 }),
      mov({ tipo: 'gasto', importe: 100 }),
    ];
    const out = filtrarYOrdenar(movs, filtro({ tipos: ['gasto'] }), { campo: 'importe', direccion: 'asc' });
    expect(out.map(m => m.importe)).toEqual([100, 300]);
  });
});

describe('hayFiltroActivo', () => {
  it('es false con el filtro vacío', () => {
    expect(hayFiltroActivo(FILTRO_MOVIMIENTOS_VACIO)).toBe(false);
  });

  it('es false si el texto es solo espacios', () => {
    expect(hayFiltroActivo(filtro({ texto: '  ' }))).toBe(false);
  });

  it.each([
    ['texto', filtro({ texto: 'tasa' })],
    ['tipos', filtro({ tipos: ['gasto'] })],
    ['dirección', filtro({ direccion: 'entradas' })],
    ['cuentas', filtro({ cuentaIds: ['c1'] })],
    ['desde', filtro({ desde: '2026-01-01' })],
    ['hasta', filtro({ hasta: '2026-01-01' })],
  ])('es true cuando hay %s', (_etiqueta, f) => {
    expect(hayFiltroActivo(f)).toBe(true);
  });
});

describe('contarPorTipo', () => {
  it('cuenta cuántos movimientos hay de cada tipo', () => {
    const movs = [mov({ tipo: 'gasto' }), mov({ tipo: 'gasto' }), mov({ tipo: 'suplido' })];
    const cuenta = contarPorTipo(movs);
    expect(cuenta.get('gasto')).toBe(2);
    expect(cuenta.get('suplido')).toBe(1);
    expect(cuenta.get('honorario')).toBeUndefined();
  });
});
