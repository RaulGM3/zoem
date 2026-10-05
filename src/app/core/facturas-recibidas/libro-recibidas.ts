/**
 * Libro registro de facturas recibidas (IVA) en el formato oficial de la AEAT para Pre303:
 * plantilla LSI.xlsx, hoja RECIBIDAS_GASTOS, 42 columnas (A..AP). Una fila por tipo de IVA.
 * Funciones puras: sin framework ni librería xlsx (la escritura del archivo es perezosa y vive en el servicio).
 */

import type { EstadoFacturaRecibida, LineaIvaRecibida, PeriodoIva } from '../../interfaces/factura-recibida.interface';
import { normalizarNif } from '../fiscal/nif';

export const COLUMNAS_LIBRO = 42;

/** Celda del libro: texto, número (importes/tipos con formato 0.00) o vacío. */
export type CeldaLibro = string | number;

/** Filas 7 a 10 de la plantilla oficial (títulos, subtítulos, tipos de dato y marca IVA/IRPF). */
export const CABECERA_LIBRO: readonly (readonly string[])[] = [
  ["Autoliquidación(12)", "", "Actividad(17)", "", "", "Tipo de Factura(10)", "Concepto de Gasto(11) (18)", "Gasto Deducible(13) (18)", "Fecha Expedición", "Fecha Operación(1)", "Identificación Factura del Expedidor", "", "Fecha Recepción(19)", "Número Recepción(37)", "Número Recepción Final(37)", "NIF Expedidor(2)", "", "", "Nombre Expedidor", "Clave de Operación(7)", "Bien de Inversión(20)", "Inversión del Sujeto Pasivo(23)", "Deducible en Periodo Posterior(21) (35)", "Periodo Deducción(22) (34)", "", "Total Factura", "Base Imponible", "Tipo de IVA", "Cuota IVA Soportado", "Cuota Deducible(36)", "Tipo de Recargo Eq.", "Cuota Recargo Eq.", "Pago (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)", "", "", "", "Tipo Retención del IRPF(16) (18)", "Importe Retenido del IRPF(16) (18)", "Registro Acuerdo Facturación(24)", "Inmueble(39)", "", "Referencia Externa"],
  ["Ejercicio", "Periodo", "Código", "Tipo", "Grupo o Epígrafe del IAE", "", "", "", "", "", "(Serie-Número)", "Número-Final", "", "", "", "Tipo", "Código País", "Identificación", "", "", "", "", "", "Ejercicio", "Periodo", "", "", "", "", "", "", "", "Fecha", "Importe", "Medio Utilizado", "Identificación Medio Utilizado", "", "", "", "Situación", "Referencia Catastral", ""],
  ["Decimal (4,0)", "Alfanumérico (2)", "Alfanumérico (1)", "Alfanumérico (2)", "Alfanumérico (4)", "Alfanumérico (2)", "Alfanumérico (3)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Fecha(dd/mm/yyyy)", "Alfanumérico (40)", "Alfanumérico (20)", "Fecha(dd/mm/yyyy)", "Alfanumérico (20)", "Alfanumérico (20)", "Alfanumérico (2)", "Alfanumérico (2)", "Alfanumérico (20)", "Alfanumérico (40)", "Alfanumérico (2)", "Alfanumérico (1)", "Alfanumérico (1)", "Alfanumérico (1)", "Decimal (4,0)", "Alfanumérico (2)", "Decimal(12,2)", "Decimal(12,2)", "Decimal(4,2)", "Decimal(12,2)", "Decimal(12,2)", "Decimal(4,2)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Decimal(12,2)", "Alfanumérico (2)", "Alfanumérico (34)", "Decimal(4,2)", "Decimal(12,2)", "Alfanumérico (15)", "Alfanumérico (1)", "Alfanumérico (20)", "Alfanumérico (40)"],
  ["", "", "", "", "", "", "IRPF", "IRPF", "", "", "", "", "IVA", "", "", "", "", "", "", "IVA", "IVA", "IVA", "IVA", "IVA", "IVA", "", "", "", "", "", "", "", "", "", "", "", "IRPF", "IRPF", "IVA", "", "", ""],
];

/** Celdas combinadas de la cabecera oficial (rangos A1 de las filas 7-8). */
export const MERGES_CABECERA: readonly string[] = ['A7:B7', 'AA7:AA8', 'AB7:AB8', 'AC7:AC8', 'AD7:AD8', 'AE7:AE8', 'AF7:AF8', 'AG7:AJ7', 'AK7:AK8', 'AL7:AL8', 'AM7:AM8', 'AN7:AO7', 'AP7:AP8', 'C7:E7', 'F7:F8', 'G7:G8', 'H7:H8', 'I7:I8', 'J7:J8', 'K7:L7', 'M7:M8', 'N7:N8', 'O7:O8', 'P7:R7', 'S7:S8', 'T7:T8', 'U7:U8', 'V7:V8', 'W7:W8', 'X7:Y7', 'Z7:Z8'];

/** Columnas numéricas (formato `0.00`): Z..AD (importes y tipo de IVA). */
export const COLUMNAS_NUMERICAS: readonly number[] = [25, 26, 27, 28, 29];

export interface FacturaParaLibro {
  id: string;
  estado: EstadoFacturaRecibida;
  numeroRecepcion: number;
  tipoFactura: string;
  proveedor: { nombre: string; nif: string };
  numero: string;
  fechaExpedicion: string;
  fechaOperacion?: string;
  fechaRegistro: string;
  periodo303: PeriodoIva;
  lineasIva: readonly LineaIvaRecibida[];
  porcentajeDeducible: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** `yyyy-MM-dd` -> `dd/MM/yyyy` (texto, como exige el libro). */
function fechaLibro(iso: string | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Filas del libro de las facturas `registrada` del periodo, por número de recepción. Una fila por línea de IVA:
 * "Total Factura" es el subtotal de la línea (validación 8 de la AEAT). Las líneas exentas salen con tipo y cuota 0
 * (el libro de recibidas no tiene columna de causa). IRPF, actividad, recargo, pago e inmueble quedan vacíos.
 */
export function filasLibroRecibidas(facturas: readonly FacturaParaLibro[], periodo: PeriodoIva): CeldaLibro[][] {
  return facturas
    .filter(
      (f) =>
        f.estado === 'registrada' &&
        f.periodo303.ejercicio === periodo.ejercicio &&
        f.periodo303.trimestre === periodo.trimestre,
    )
    .sort((a, b) => a.numeroRecepcion - b.numeroRecepcion)
    .flatMap((f) =>
      f.lineasIva.map((l): CeldaLibro[] => {
        const fila: CeldaLibro[] = new Array<CeldaLibro>(COLUMNAS_LIBRO).fill('');
        const cuota = l.exento ? 0 : l.cuota;
        fila[0] = f.periodo303.ejercicio; // A
        fila[1] = `${f.periodo303.trimestre}T`; // B
        fila[5] = f.tipoFactura; // F
        fila[8] = fechaLibro(f.fechaExpedicion); // I
        fila[9] = fechaLibro(f.fechaOperacion); // J
        fila[10] = f.numero; // K
        fila[12] = fechaLibro(f.fechaRegistro); // M
        fila[13] = String(f.numeroRecepcion); // N
        fila[17] = normalizarNif(f.proveedor.nif); // R (P vacío: NIF español)
        fila[18] = f.proveedor.nombre; // S
        fila[19] = '01'; // T
        fila[20] = 'N'; // U bien de inversión
        fila[21] = 'N'; // V inversión del sujeto pasivo
        fila[22] = 'N'; // W deducible en periodo posterior
        fila[25] = round2(l.base + cuota); // Z
        fila[26] = round2(l.base); // AA
        fila[27] = l.exento ? 0 : round2(l.tipo); // AB
        fila[28] = round2(cuota); // AC
        fila[29] = round2((cuota * f.porcentajeDeducible) / 100); // AD
        fila[41] = f.id; // AP
        return fila;
      }),
    );
}

/** Nombre de archivo de la plantilla: ejercicio + NIF + tipo de libro `R` + nombre o razón social. */
export function nombreArchivoLibro(ejercicio: number, nif: string, nombre: string): string {
  const limpio = nombre.replace(/[\\/:*?"<>|]/g, '').trim();
  return `${ejercicio}${normalizarNif(nif)}R${limpio}.xlsx`;
}
