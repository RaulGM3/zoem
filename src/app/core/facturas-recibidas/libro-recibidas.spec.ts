import { describe, it, expect } from 'vitest';
import {
  CABECERA_LIBRO,
  COLUMNAS_LIBRO,
  filasLibroRecibidas,
  nombreArchivoLibro,
  type FacturaParaLibro,
} from './libro-recibidas';

const COL = (letras: string): number => [...letras].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

const f = (over: Partial<FacturaParaLibro> = {}): FacturaParaLibro => ({
  id: 'ID1',
  estado: 'registrada',
  numeroRecepcion: 7,
  tipoFactura: 'F1',
  proveedor: { nombre: 'Proveedor SL', nif: 'B12345674' },
  numero: 'F-001',
  fechaExpedicion: '2026-04-02',
  fechaRegistro: '2026-04-05',
  periodo303: { ejercicio: 2026, trimestre: 2 },
  lineasIva: [{ base: 100, tipo: 21, cuota: 21 }],
  porcentajeDeducible: 100,
  ...over,
});
const P2 = { ejercicio: 2026, trimestre: 2 } as const;

describe('filasLibroRecibidas', () => {
  it('el libro oficial tiene 42 columnas (A..AP) en la cabecera y en cada fila', () => {
    expect(COLUMNAS_LIBRO).toBe(42);
    for (const fila of CABECERA_LIBRO) expect(fila).toHaveLength(42);
    expect(filasLibroRecibidas([f()], P2)[0]).toHaveLength(42);
  });

  it('mapea una factura de un tipo a las columnas oficiales', () => {
    const [fila] = filasLibroRecibidas([f({ fechaOperacion: '2026-03-30' })], P2);
    const v = (l: string) => fila[COL(l)];
    expect(v('A')).toBe(2026);
    expect(v('B')).toBe('2T');
    expect(v('F')).toBe('F1');
    expect(v('I')).toBe('02/04/2026');
    expect(v('J')).toBe('30/03/2026');
    expect(v('K')).toBe('F-001');
    expect(v('M')).toBe('05/04/2026');
    expect(v('N')).toBe('7');
    expect(v('P')).toBe('');
    expect(v('R')).toBe('B12345674');
    expect(v('S')).toBe('Proveedor SL');
    expect(v('T')).toBe('01');
    expect(v('U')).toBe('N');
    expect(v('V')).toBe('N');
    expect(v('W')).toBe('N');
    expect(v('Z')).toBe(121);
    expect(v('AA')).toBe(100);
    expect(v('AB')).toBe(21);
    expect(v('AC')).toBe(21);
    expect(v('AD')).toBe(21);
    expect(v('AP')).toBe('ID1');
  });

  it('una fila por tipo de IVA y el Total Factura es el subtotal de cada línea', () => {
    const filas = filasLibroRecibidas(
      [f({ lineasIva: [{ base: 100, tipo: 21, cuota: 21 }, { base: 50, tipo: 10, cuota: 5 }] })],
      P2,
    );
    expect(filas).toHaveLength(2);
    expect(filas.map((r) => r[COL('Z')])).toEqual([121, 55]);
    expect(filas.map((r) => r[COL('AB')])).toEqual([21, 10]);
    // Misma factura: mismo número de recepción y misma identificación en ambas filas.
    expect(filas[0][COL('N')]).toBe(filas[1][COL('N')]);
    expect(filas[0][COL('K')]).toBe(filas[1][COL('K')]);
  });

  it('la cuota deducible aplica el porcentaje redondeado a 2 decimales', () => {
    const [fila] = filasLibroRecibidas([f({ porcentajeDeducible: 50, lineasIva: [{ base: 33.33, tipo: 21, cuota: 7 }] })], P2);
    expect(fila[COL('AC')]).toBe(7);
    expect(fila[COL('AD')]).toBe(3.5);
  });

  it('línea exenta: tipo 0 y cuota 0 (el libro no tiene columna de causa), sin romper el total', () => {
    const [fila] = filasLibroRecibidas(
      [f({ lineasIva: [{ base: 80, tipo: 0, cuota: 0, exento: true, causaExencion: 'E1' }] })],
      P2,
    );
    expect(fila[COL('Z')]).toBe(80);
    expect(fila[COL('AA')]).toBe(80);
    expect(fila[COL('AB')]).toBe(0);
    expect(fila[COL('AC')]).toBe(0);
    expect(fila[COL('AD')]).toBe(0);
  });

  it('solo incluye registradas del periodo pedido (override incluido), ordenadas por número de recepción', () => {
    const filas = filasLibroRecibidas(
      [
        f({ id: 'C', numeroRecepcion: 3 }),
        f({ id: 'A', numeroRecepcion: 1 }),
        f({ id: 'X', estado: 'anulada', numeroRecepcion: 2 }),
        f({ id: 'T1', periodo303: { ejercicio: 2026, trimestre: 1 } }),
        f({ id: 'Y25', periodo303: { ejercicio: 2025, trimestre: 2 } }),
      ],
      P2,
    );
    expect(filas.map((r) => r[COL('AP')])).toEqual(['A', 'C']);
  });

  it('trimestre vacío: sin filas', () => {
    expect(filasLibroRecibidas([], P2)).toEqual([]);
  });

  it('redondea importes a 2 decimales (sin ruido de coma flotante)', () => {
    const [fila] = filasLibroRecibidas([f({ lineasIva: [{ base: 0.1, tipo: 21, cuota: 0.2 }] })], P2);
    expect(fila[COL('Z')]).toBe(0.3);
  });

  it('las columnas IRPF, actividad, recargo, pago e inmueble van vacías', () => {
    const [fila] = filasLibroRecibidas([f()], P2);
    for (const l of ['C', 'D', 'E', 'G', 'H', 'L', 'O', 'Q', 'X', 'Y', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO']) {
      expect(fila[COL(l)], l).toBe('');
    }
  });
});

describe('nombreArchivoLibro', () => {
  it('ejercicio + NIF + R + nombre', () => {
    expect(nombreArchivoLibro(2026, 'B12345674', 'Mi Empresa SL')).toBe('2026B12345674RMi Empresa SL.xlsx');
  });

  it('normaliza el NIF y quita caracteres no válidos en nombres de archivo', () => {
    expect(nombreArchivoLibro(2026, 'es-b12345674', 'A/B: "C"?')).toBe('2026B12345674RAB C.xlsx');
  });
});
