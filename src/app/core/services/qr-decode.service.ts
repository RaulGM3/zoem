import { inject, Injectable, InjectionToken } from '@angular/core';
import { parseQrVerifactu, type ResultadoParseQr } from '../facturas-recibidas/qr-verifactu';

/** Píxeles RGBA de una imagen (compatible con `ImageData`, pero construible sin canvas en tests). */
export interface PixelesQr {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Costuras con el navegador (canvas, pdf.js, jsQR). Las reales cargan sus librerías con `import()` perezoso. */
export interface QrDecodePorts {
  imagenAPixeles(archivo: File): Promise<PixelesQr | null>;
  /** Primera página del PDF renderizada a escala 2. */
  pdfAPixeles(archivo: File): Promise<PixelesQr | null>;
  leerQr(pixeles: PixelesQr): Promise<string | null>;
}

/** Lado máximo al rasterizar una foto: suficiente para un QR y acota el coste en móvil. */
const LADO_MAX_IMAGEN = 2400;
const RUTA_WORKER_PDFJS = 'assets/pdfjs/pdf.worker.min.mjs';

export async function leerQrDePixeles(pixeles: PixelesQr): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  return jsQR(pixeles.data, pixeles.width, pixeles.height)?.data ?? null;
}

function canvasContext(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return ctx ? { canvas, ctx } : null;
}

async function imagenAPixeles(archivo: File): Promise<PixelesQr | null> {
  const bitmap = await createImageBitmap(archivo);
  try {
    const escala = Math.min(1, LADO_MAX_IMAGEN / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));
    const c = canvasContext(w, h);
    if (!c) return null;
    c.ctx.drawImage(bitmap, 0, 0, w, h);
    return c.ctx.getImageData(0, 0, w, h);
  } finally {
    bitmap.close();
  }
}

async function pdfAPixeles(archivo: File): Promise<PixelesQr | null> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(RUTA_WORKER_PDFJS, document.baseURI).toString();
  const tarea = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) });
  const doc = await tarea.promise;
  try {
    const pagina = await doc.getPage(1);
    const viewport = pagina.getViewport({ scale: 2 });
    const c = canvasContext(Math.ceil(viewport.width), Math.ceil(viewport.height));
    if (!c) return null;
    await pagina.render({ canvas: c.canvas, canvasContext: c.ctx, viewport }).promise;
    return c.ctx.getImageData(0, 0, c.canvas.width, c.canvas.height);
  } finally {
    await tarea.destroy();
  }
}

export const QR_DECODE_PORTS = new InjectionToken<QrDecodePorts>('QR_DECODE_PORTS', {
  providedIn: 'root',
  factory: () => ({ imagenAPixeles, pdfAPixeles, leerQr: leerQrDePixeles }),
});

/**
 * Busca el QR de Verifactu en el archivo de una factura (imagen o página 1 de un PDF), en memoria y en el
 * cliente. Es un extra: cualquier fallo se traduce en "sin QR" y jamás impide registrar la factura.
 */
@Injectable({ providedIn: 'root' })
export class QrDecodeService {
  private readonly ports = inject(QR_DECODE_PORTS);

  /** `null` = no hay QR legible; `ok:false` = hay un QR pero no es de validación de la AEAT. */
  async leer(archivo: File): Promise<ResultadoParseQr | null> {
    try {
      const tipo = archivo.type.toLowerCase();
      const pixeles =
        tipo === 'application/pdf'
          ? await this.ports.pdfAPixeles(archivo)
          : tipo.startsWith('image/')
            ? await this.ports.imagenAPixeles(archivo)
            : null;
      if (!pixeles) return null;
      const texto = await this.ports.leerQr(pixeles);
      return texto ? parseQrVerifactu(texto) : null;
    } catch {
      return null;
    }
  }
}
