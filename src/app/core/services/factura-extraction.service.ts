import { inject, Injectable } from '@angular/core';
import { Schema } from 'firebase/ai';
import { CupoIaAgotadoError, mensajeDeError } from '../agent/errores-ia';
import { IaCupoService } from '../planes/ia-cupo';
import { AiService } from './ai.service';
import { normalizarNif } from '../fiscal/nif';
import { esFechaIso } from '../facturas-recibidas/trimestre';

/** Datos que Gemini lee de la factura. El usuario SIEMPRE los revisa y confirma antes de guardar nada. */
export interface DatosExtraidos {
  proveedorNombre: string;
  proveedorNif: string;
  numero: string;
  tipoFactura: 'F1' | 'F2';
  /** ISO `yyyy-MM-dd` o `''` si no se pudo leer. */
  fechaExpedicion: string;
  lineasIva: { base: number; tipo: number; cuota: number }[];
  total: number | null;
  concepto: string;
}

export type ResultadoExtraccion = { ok: true; datos: DatosExtraidos } | { ok: false; mensaje: string };

const MAX_BYTES = 15 * 1024 * 1024;

const MENSAJE_FALLO =
  'No se pudo leer la factura automáticamente. Rellena los datos a mano; el archivo se adjuntará igualmente.';

const SCHEMA = Schema.object({
  properties: {
    proveedorNombre: Schema.string(),
    proveedorNif: Schema.string(),
    numero: Schema.string(),
    tipoFactura: Schema.enumString({ enum: ['F1', 'F2'] }),
    fechaExpedicion: Schema.string(),
    lineasIva: Schema.array({
      items: Schema.object({
        properties: { base: Schema.number(), tipo: Schema.number(), cuota: Schema.number() },
        optionalProperties: ['cuota'],
      }),
    }),
    total: Schema.number(),
    concepto: Schema.string(),
  },
  optionalProperties: ['proveedorNombre', 'proveedorNif', 'numero', 'tipoFactura', 'fechaExpedicion', 'total', 'concepto'],
});

const PROMPT = `Eres un asistente que lee facturas recibidas por un despacho de abogados español para registrar su IVA soportado.
Te doy una factura (PDF o imagen). Devuelve EXCLUSIVAMENTE JSON con los datos del EMISOR (el proveedor que la expide, no el cliente):

- "proveedorNombre": nombre o razón social del emisor.
- "proveedorNif": NIF/CIF del emisor, sin espacios ni guiones.
- "numero": número (y serie) de la factura tal y como figura.
- "tipoFactura": "F1" si es una factura completa, "F2" si es una factura simplificada (ticket). No uses otros valores.
- "fechaExpedicion": fecha de expedición en formato aaaa-mm-dd.
- "lineasIva": una entrada por cada tipo de IVA del desglose, con "base" (base imponible), "tipo" (porcentaje, p. ej. 21) y "cuota" (importe del IVA). Importes como números con punto decimal.
- "total": importe total de la factura.
- "concepto": descripción breve de lo facturado (máx. 100 caracteres).

NO inventes datos: omite el campo si no aparece en el documento. Los importes y fechas deben salir del documento, no calcularlos.`;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

interface Crudo {
  proveedorNombre?: unknown;
  proveedorNif?: unknown;
  numero?: unknown;
  tipoFactura?: unknown;
  fechaExpedicion?: unknown;
  lineasIva?: unknown;
  total?: unknown;
  concepto?: unknown;
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Admite aaaa-mm-dd y dd/mm/aaaa (o con guiones); devuelve ISO o `''`. */
function fechaIso(v: unknown): string {
  const s = texto(v);
  const m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(s);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : s;
  return esFechaIso(iso) ? iso : '';
}

@Injectable({ providedIn: 'root' })
export class FacturaExtractionService {
  private readonly ai = inject(AiService);
  private readonly cupo = inject(IaCupoService);

  /** Nunca lanza: ante cualquier fallo devuelve `ok: false` y el drawer abre el formulario vacío. */
  async extraer(file: File): Promise<ResultadoExtraccion> {
    if (file.size > MAX_BYTES) {
      return { ok: false, mensaje: 'El archivo supera el límite de 15 MB; rellena los datos a mano.' };
    }
    try {
      const data = await this.aBase64(file);
      await this.cupo.reservar();
      const model = this.ai.getJsonModel(SCHEMA);
      const result = await model.generateContent([{ text: PROMPT }, { inlineData: { data, mimeType: file.type } }]);
      const crudo = JSON.parse(result.response.text()) as Crudo;
      return { ok: true, datos: this.normalizar(crudo) };
    } catch (e) {
      return { ok: false, mensaje: e instanceof CupoIaAgotadoError ? mensajeDeError(e) : MENSAJE_FALLO };
    }
  }

  private normalizar(c: Crudo): DatosExtraidos {
    const lineasIva: DatosExtraidos['lineasIva'] = [];
    for (const l of Array.isArray(c.lineasIva) ? (c.lineasIva as Record<string, unknown>[]) : []) {
      const base = numero(l?.['base']);
      const tipo = numero(l?.['tipo']);
      if (base === null || tipo === null) continue;
      const cuota = numero(l['cuota']) ?? round2((base * tipo) / 100);
      lineasIva.push({ base: round2(base), tipo, cuota: round2(cuota) });
    }
    const totalLeido = numero(c.total);
    const total =
      totalLeido !== null
        ? round2(totalLeido)
        : lineasIva.length > 0
          ? round2(lineasIva.reduce((s, l) => s + l.base + l.cuota, 0))
          : null;

    return {
      proveedorNombre: texto(c.proveedorNombre),
      proveedorNif: normalizarNif(texto(c.proveedorNif)),
      numero: texto(c.numero),
      tipoFactura: c.tipoFactura === 'F2' ? 'F2' : 'F1',
      fechaExpedicion: fechaIso(c.fechaExpedicion),
      lineasIva,
      total,
      concepto: texto(c.concepto),
    };
  }

  private aBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }
}
