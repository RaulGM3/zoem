import { Injectable } from '@angular/core';
import type { PeriodoIva } from '../../interfaces/factura-recibida.interface';
import {
  CABECERA_LIBRO,
  COLUMNAS_NUMERICAS,
  MERGES_CABECERA,
  filasLibroRecibidas,
  nombreArchivoLibro,
  type FacturaParaLibro,
} from '../facturas-recibidas/libro-recibidas';

export interface EmpresaLibro {
  nif: string;
  nombre: string;
}

export interface LibroGenerado {
  nombreArchivo: string;
  datos: Uint8Array;
  /** Filas de datos (una por tipo de IVA). */
  filas: number;
}

const HOJA = 'RECIBIDAS_GASTOS';
const TIPO_LIBRO_TXT =
  '@ (Tipo de Libro Registro): V (Unificado de Facturas Recibidas -IVA- y de Compras y Gastos -IRPF-); R (Facturas Recibidas -IVA-); G (Compras y Gastos -IRPF-)';
/** Columna I (índice 8): ahí van los metadatos de las filas 2 a 5 en la plantilla. */
const COL_METADATOS = 8;

/**
 * Exporta el libro registro de facturas recibidas con el formato oficial de la AEAT (Pre303).
 * La librería `xlsx` se carga con `import()` perezoso: no entra en el bundle inicial.
 */
@Injectable({ providedIn: 'root' })
export class LibroRecibidasExportService {
  /** Genera el xlsx de un trimestre, o `null` si no hay facturas registradas en él. */
  async generar(facturas: readonly FacturaParaLibro[], periodo: PeriodoIva, empresa: EmpresaLibro): Promise<LibroGenerado | null> {
    const filas = filasLibroRecibidas(facturas, periodo);
    if (filas.length === 0) return null;

    const XLSX = await import('xlsx');
    const nombreArchivo = nombreArchivoLibro(periodo.ejercicio, empresa.nif, empresa.nombre);

    const aoa: (string | number)[][] = [
      ['', '', '', '', '', '', '', '', '', `LIBRO REGISTRO FACTURAS RECIBIDAS Y LIBRO REGISTRO DE COMPRAS Y GASTOS (Nombre del fichero: ${nombreArchivo.replace(/\.xlsx$/, '')})`],
      [],
      [],
      [],
      [],
      [],
      ...CABECERA_LIBRO.map((fila) => [...fila]),
      ...filas,
    ];
    const meta = [`Ejercicio: ${periodo.ejercicio}`, `NIF: ${empresa.nif}`, TIPO_LIBRO_TXT, `NOMBRE O RAZÓN SOCIAL: ${empresa.nombre}`];
    meta.forEach((texto, i) => {
      aoa[1 + i] = [];
      aoa[1 + i][COL_METADATOS] = texto;
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = MERGES_CABECERA.map((r) => XLSX.utils.decode_range(r));
    const primeraFila = 6 + CABECERA_LIBRO.length; // índice 0-based de la primera fila de datos
    filas.forEach((_, i) => {
      for (const c of COLUMNAS_NUMERICAS) {
        const celda = ws[XLSX.utils.encode_cell({ r: primeraFila + i, c })];
        if (celda && celda.t === 'n') celda.z = '0.00';
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, HOJA);
    const salida = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    return { nombreArchivo, datos: new Uint8Array(salida), filas: filas.length };
  }

  /** Genera y descarga el archivo. `false` si el trimestre no tiene facturas (no se descarga nada). */
  async exportar(facturas: readonly FacturaParaLibro[], periodo: PeriodoIva, empresa: EmpresaLibro): Promise<boolean> {
    const libro = await this.generar(facturas, periodo, empresa);
    if (!libro) return false;
    const blob = new Blob([libro.datos as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = libro.nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
}
