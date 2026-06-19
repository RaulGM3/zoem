/**
 * Módulo PURO de conciliación bancaria. Sin dependencias de framework.
 *
 * Dos responsabilidades:
 *  1. `parseExtractoCsv` — parsea un CSV de banco (formato español o anglosajón).
 *  2. `autoMatch` — casa líneas del extracto contra movimientos de gestoría.
 */

import type { LineaExtractoParseada } from '../../interfaces';

export interface ParseResult {
  lineas: LineaExtractoParseada[];
  errores: string[];
}

/** Movimiento mínimo necesario para casar (signo derivado de `esEntrada`). */
export interface MovimientoCasable {
  id: string;
  fecha: string;
  importe: number;
  esEntrada: boolean;
}

export interface Match {
  lineaIndex: number;
  movimientoId: string;
}

const COLUMNAS = {
  fecha: ['fecha', 'date', 'f. valor', 'fecha valor', 'f.valor'],
  concepto: ['concepto', 'descripcion', 'descripción', 'concept', 'description', 'detalle'],
  importe: ['importe', 'amount', 'cantidad', 'monto'],
  saldo: ['saldo', 'balance'],
};

function detectarDelimitador(header: string): string {
  if (header.includes(';')) return ';';
  if (header.includes('\t')) return '\t';
  return ',';
}

function indiceColumna(headers: string[], claves: string[]): number {
  return headers.findIndex(h => claves.includes(h.trim().toLowerCase()));
}

/** Parsea un importe respetando el formato decimal según el delimitador. */
function parseImporte(raw: string, delimitador: string): number {
  let s = raw.trim().replace(/[€$\s]/g, '');
  if (delimitador === ';') {
    // Formato español: 1.234,56 → quitar miles '.', coma decimal → '.'
    s = s.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(s);
}

/** Normaliza una fecha a YYYY-MM-DD (acepta dd/mm/yyyy, dd-mm-yyyy o ya ISO). */
function parseFecha(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function parseExtractoCsv(text: string): ParseResult {
  const filas = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (filas.length < 2) return { lineas: [], errores: ['El archivo no tiene filas de datos.'] };

  const delimitador = detectarDelimitador(filas[0]);
  const headers = filas[0].split(delimitador);
  const iFecha = indiceColumna(headers, COLUMNAS.fecha);
  const iConcepto = indiceColumna(headers, COLUMNAS.concepto);
  const iImporte = indiceColumna(headers, COLUMNAS.importe);
  const iSaldo = indiceColumna(headers, COLUMNAS.saldo);

  if (iFecha < 0 || iConcepto < 0 || iImporte < 0) {
    return { lineas: [], errores: ['No se encontraron las columnas Fecha, Concepto e Importe.'] };
  }

  const lineas: LineaExtractoParseada[] = [];
  const errores: string[] = [];

  for (let i = 1; i < filas.length; i++) {
    const cols = filas[i].split(delimitador);
    const fecha = cols[iFecha] != null ? parseFecha(cols[iFecha]) : null;
    const concepto = cols[iConcepto]?.trim() ?? '';
    const importe = cols[iImporte] != null ? parseImporte(cols[iImporte], delimitador) : NaN;

    if (!fecha || !concepto || Number.isNaN(importe)) {
      errores.push(`Fila ${i + 1}: datos inválidos.`);
      continue;
    }

    const linea: LineaExtractoParseada = { fecha, concepto, importe };
    if (iSaldo >= 0 && cols[iSaldo] != null) {
      const saldo = parseImporte(cols[iSaldo], delimitador);
      if (!Number.isNaN(saldo)) linea.saldoPosterior = saldo;
    }
    lineas.push(linea);
  }

  return { lineas, errores };
}

function diasEntre(a: string, b: string): number {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

/**
 * Casa líneas del extracto contra movimientos por importe (con signo) y fecha
 * (dentro de `toleranciaDias`). Cada movimiento se usa como mucho una vez.
 */
export function autoMatch(
  lineas: LineaExtractoParseada[],
  movimientos: MovimientoCasable[],
  toleranciaDias = 3,
): Match[] {
  const usados = new Set<string>();
  const matches: Match[] = [];

  lineas.forEach((linea, lineaIndex) => {
    const candidato = movimientos.find(m => {
      if (usados.has(m.id)) return false;
      const signo = m.esEntrada ? m.importe : -m.importe;
      return Math.abs(signo - linea.importe) < 0.01 && diasEntre(m.fecha, linea.fecha) <= toleranciaDias;
    });
    if (candidato) {
      usados.add(candidato.id);
      matches.push({ lineaIndex, movimientoId: candidato.id });
    }
  });

  return matches;
}
