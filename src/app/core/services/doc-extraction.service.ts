import { inject, Injectable } from '@angular/core';
import { Schema } from 'firebase/ai';
import * as mammoth from 'mammoth';
import { AiService } from './ai.service';
import { TemplateVariable, TemplateVariableType } from '../../interfaces';

export interface ExtractionResult {
  html: string;
  variables: TemplateVariable[];
}

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';
const MAX_PDF_BYTES = 15 * 1024 * 1024; // límite request inline de Gemini: 20MB (base64 añade ~33%)
const MAX_DOCX_BYTES = 15 * 1024 * 1024; // consistente con el límite anunciado en la UI de subida

const VARIABLE_TYPES: readonly TemplateVariableType[] = ['text', 'textarea', 'date', 'number', 'currency', 'email'];

const EXTRACTION_SCHEMA = Schema.object({
  properties: {
    html: Schema.string(),
    variables: Schema.array({
      items: Schema.object({
        properties: {
          key: Schema.string(),
          label: Schema.string(),
          type: Schema.enumString({ enum: [...VARIABLE_TYPES] }),
          description: Schema.string(),
          required: Schema.boolean(),
        },
        optionalProperties: ['description'],
      }),
    }),
  },
});

const EXTRACTION_PROMPT = `Eres un asistente legal que convierte documentos en plantillas reutilizables para un despacho de abogados español.
Te doy un documento. Devuelve EXCLUSIVAMENTE JSON con:

1. "html": el documento completo convertido a HTML semántico y limpio, preservando su estructura (párrafos, encabezados, listas, tablas, negritas). Sustituye cada dato variable o rellenable (nombres de personas o empresas, DNI/NIE/CIF, direcciones, fechas, importes, números de expediente, teléfonos, emails, etc.) por un marcador {{clave}} en snake_case. Usa la MISMA clave para el mismo dato cuando se repite. NO inventes contenido que no esté en el documento. NO incluyas estilos CSS ni las etiquetas <html>, <head> o <body>: solo el fragmento de contenido.

2. "variables": lista de cada {{clave}} única usada en el html, con:
   - "key": la clave exacta en snake_case, igual al marcador.
   - "label": etiqueta legible en español (ej. "Nombre completo").
   - "type": uno de text | textarea | date | number | currency | email.
   - "description": qué dato es y en qué documento de origen suele encontrarse (ej. "Número de DNI del cliente, aparece en el anverso del DNI").
   - "required": true si el documento no tiene sentido sin ese dato.`;

@Injectable({ providedIn: 'root' })
export class DocExtractionService {
  private readonly ai = inject(AiService);

  async extractFromFile(file: File): Promise<ExtractionResult> {
    const name = file.name.toLowerCase();
    if (file.type === PDF_MIME || name.endsWith('.pdf')) {
      return this.extractFromPdf(file);
    }
    if (file.type === DOCX_MIME || name.endsWith('.docx')) {
      return this.extractFromDocx(file);
    }
    if (file.type === DOC_MIME || name.endsWith('.doc')) {
      throw new Error('El formato .doc antiguo no está soportado. Convierte el archivo a .docx o PDF.');
    }
    throw new Error('Formato no soportado. Sube un archivo PDF o Word (.docx).');
  }

  private async extractFromPdf(file: File): Promise<ExtractionResult> {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error('El PDF supera el límite de 15MB. Reduce el tamaño del archivo.');
    }
    const data = await this.fileToBase64(file);
    return this.runExtraction([
      { text: EXTRACTION_PROMPT },
      { inlineData: { data, mimeType: PDF_MIME } },
    ]);
  }

  private async extractFromDocx(file: File): Promise<ExtractionResult> {
    if (file.size > MAX_DOCX_BYTES) {
      throw new Error('El documento Word supera el límite de 15MB. Reduce el tamaño del archivo.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const { value: sourceHtml } = await mammoth.convertToHtml({ arrayBuffer });
    if (!sourceHtml.trim()) {
      throw new Error('No se pudo extraer contenido del documento Word.');
    }
    return this.runExtraction([
      { text: EXTRACTION_PROMPT },
      { text: `Documento de origen (HTML):\n${sourceHtml}` },
    ]);
  }

  private async runExtraction(
    parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>
  ): Promise<ExtractionResult> {
    const model = this.ai.getJsonModel(EXTRACTION_SCHEMA);
    const result = await model.generateContent(parts);
    const parsed = JSON.parse(result.response.text()) as ExtractionResult;
    return this.reconcile(parsed);
  }

  /** Garantiza que cada {{key}} del html tenga variable y viceversa. */
  private reconcile(result: ExtractionResult): ExtractionResult {
    const html = result.html ?? '';
    const htmlKeys = new Set<string>();
    for (const match of html.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
      htmlKeys.add(match[1]);
    }

    const seen = new Set<string>();
    const variables: TemplateVariable[] = [];
    for (const v of result.variables ?? []) {
      if (!v?.key || seen.has(v.key) || !htmlKeys.has(v.key)) continue;
      seen.add(v.key);
      variables.push({
        key: v.key,
        label: v.label || this.humanize(v.key),
        type: VARIABLE_TYPES.includes(v.type) ? v.type : 'text',
        description: v.description || undefined,
        required: v.required ?? true,
      });
    }

    for (const key of htmlKeys) {
      if (seen.has(key)) continue;
      variables.push({ key, label: this.humanize(key), type: 'text', required: true });
    }

    if (!html.trim() || variables.length === 0) {
      throw new Error('No se pudieron detectar datos variables en el documento. Revisa que el documento tenga contenido rellenable.');
    }

    return { html, variables };
  }

  private humanize(key: string): string {
    const label = key.replace(/_/g, ' ').trim();
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }
}
