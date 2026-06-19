import { describe, it, expect } from 'vitest';
import { parseExtractoCsv, autoMatch } from './conciliacion';

describe('parseExtractoCsv', () => {
  it('parsea un CSV español (delimitador ; y decimal 1.234,56)', () => {
    const csv = [
      'Fecha;Concepto;Importe;Saldo',
      '15/01/2026;Transferencia cliente;1.210,00;5.000,00',
      '16/01/2026;Pago tasas;-121,50;4.878,50',
    ].join('\n');

    const { lineas, errores } = parseExtractoCsv(csv);

    expect(errores).toEqual([]);
    expect(lineas).toEqual([
      { fecha: '2026-01-15', concepto: 'Transferencia cliente', importe: 1210, saldoPosterior: 5000 },
      { fecha: '2026-01-16', concepto: 'Pago tasas', importe: -121.5, saldoPosterior: 4878.5 },
    ]);
  });

  it('parsea un CSV con delimitador coma y decimal punto', () => {
    const csv = ['fecha,concepto,importe', '2026-02-01,Honorarios,242.00'].join('\n');
    const { lineas, errores } = parseExtractoCsv(csv);
    expect(errores).toEqual([]);
    expect(lineas).toEqual([{ fecha: '2026-02-01', concepto: 'Honorarios', importe: 242 }]);
  });

  it('reporta filas inválidas sin abortar el resto', () => {
    const csv = ['Fecha;Concepto;Importe', '15/01/2026;Buena;100,00', 'fila;rota'].join('\n');
    const { lineas, errores } = parseExtractoCsv(csv);
    expect(lineas).toHaveLength(1);
    expect(errores).toHaveLength(1);
  });

  it('falla limpio si no encuentra las columnas requeridas', () => {
    const { lineas, errores } = parseExtractoCsv('col1;col2\na;b');
    expect(lineas).toEqual([]);
    expect(errores.length).toBeGreaterThan(0);
  });
});

describe('autoMatch', () => {
  const movimientos = [
    { id: 'm1', fecha: '2026-01-15', importe: 1210, esEntrada: true },
    { id: 'm2', fecha: '2026-01-16', importe: 121.5, esEntrada: false },
  ];

  it('casa por importe con signo y fecha dentro de tolerancia', () => {
    const lineas = [
      { fecha: '2026-01-15', concepto: 'x', importe: 1210 },
      { fecha: '2026-01-17', concepto: 'y', importe: -121.5 },
    ];
    const matches = autoMatch(lineas, movimientos, 3);
    expect(matches).toEqual([
      { lineaIndex: 0, movimientoId: 'm1' },
      { lineaIndex: 1, movimientoId: 'm2' },
    ]);
  });

  it('no casa si la fecha excede la tolerancia', () => {
    const lineas = [{ fecha: '2026-02-20', concepto: 'x', importe: 1210 }];
    expect(autoMatch(lineas, movimientos, 3)).toEqual([]);
  });

  it('no reutiliza un movimiento ya casado', () => {
    const lineas = [
      { fecha: '2026-01-15', concepto: 'x', importe: 1210 },
      { fecha: '2026-01-15', concepto: 'dup', importe: 1210 },
    ];
    const matches = autoMatch(lineas, movimientos, 3);
    expect(matches).toEqual([{ lineaIndex: 0, movimientoId: 'm1' }]);
  });
});
