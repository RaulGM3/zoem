import { Injectable } from '@angular/core';

/** Qué aceptan los inputs de archivo (HEIC queda fuera a propósito: ni Gemini ni las rules de Storage lo admiten). */
export const ACCEPT_FACTURA = 'application/pdf,image/jpeg,image/png,image/webp';
/** El input "Hacer foto" (`capture="environment"`) solo ofrece imágenes. */
export const ACCEPT_FOTO = 'image/jpeg,image/png,image/webp';

const MAX_BYTES = 15 * 1024 * 1024; // límite inline de Gemini (20 MB) con margen por el base64

const MIME_POR_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const MIMES_VALIDOS = new Set(Object.values(MIME_POR_EXTENSION));

export type ResultadoCaptura = { ok: true; archivo: File } | { ok: false; mensaje: string };

/**
 * Validación del archivo de una factura recibida elegido en la web (selector de archivos o cámara
 * del navegador). La captura nativa con `@capacitor/camera` (JPEG) llega en otra fase.
 */
@Injectable({ providedIn: 'root' })
export class CapturaArchivoService {
  validar(file: File): ResultadoCaptura {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const tipo = file.type.toLowerCase();

    if (tipo === 'image/heic' || tipo === 'image/heif' || extension === 'heic' || extension === 'heif') {
      return {
        ok: false,
        mensaje:
          'Las fotos en formato HEIC no se admiten en la web. Haz la foto en JPEG (ajuste de la cámara "Más compatible") o expórtala a JPEG o PNG.',
      };
    }

    const mime = MIMES_VALIDOS.has(tipo) ? tipo : tipo === '' ? MIME_POR_EXTENSION[extension] : undefined;
    if (!mime) return { ok: false, mensaje: 'Formato no soportado. Sube un PDF o una imagen JPEG, PNG o WebP.' };
    if (file.size === 0) return { ok: false, mensaje: 'El archivo está vacío.' };
    if (file.size > MAX_BYTES) return { ok: false, mensaje: 'El archivo supera el límite de 15 MB. Reduce su tamaño.' };

    return { ok: true, archivo: file.type === mime ? file : new File([file], file.name, { type: mime }) };
  }
}
