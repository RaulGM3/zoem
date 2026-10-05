import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

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

export type OrigenFoto = 'camara' | 'galeria';
/** Captura nativa: igual que `ResultadoCaptura` más "el usuario cerró la cámara/galería" (no es un error). */
export type ResultadoCapturaNativa = ResultadoCaptura | { ok: false; cancelado: true };

const CALIDAD_JPEG = 85;

/**
 * Captura y validación del archivo de una factura recibida. En la web, valida lo elegido en el
 * selector de archivos o la cámara del navegador. En nativo (iOS/Android), `capturar` abre la cámara o la
 * galería con `@capacitor/camera` y entrega siempre un JPEG; los PDF siguen entrando por el selector de archivos.
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

  /** `true` dentro de la app nativa (Capacitor). Se lee en cada llamada para no fijar el valor al crear el servicio. */
  esNativo(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** Hace una foto o elige una de la galería (nativo). Cancelar no es un error; un permiso denegado sí lleva mensaje. */
  async capturar(origen: OrigenFoto): Promise<ResultadoCapturaNativa> {
    let webPath: string | undefined;
    try {
      const foto = await Camera.getPhoto({
        source: origen === 'camara' ? CameraSource.Camera : CameraSource.Photos,
        resultType: CameraResultType.Uri,
        quality: CALIDAD_JPEG,
        correctOrientation: true,
        saveToGallery: false,
      });
      webPath = foto.webPath;
    } catch (e) {
      return this.errorNativo(e);
    }

    if (!webPath) return { ok: false, mensaje: 'No se pudo obtener la foto. Inténtalo de nuevo.' };
    try {
      const respuesta = await fetch(webPath);
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const blob = await respuesta.blob();
      const archivo = new File([blob], `factura-${Date.now()}.jpg`, { type: 'image/jpeg' });
      return this.validar(archivo);
    } catch {
      return { ok: false, mensaje: 'No se pudo leer la foto. Inténtalo de nuevo.' };
    }
  }

  private errorNativo(e: unknown): ResultadoCapturaNativa {
    const texto = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (texto.includes('cancel')) return { ok: false, cancelado: true };
    if (texto.includes('denied') || texto.includes('permission') || texto.includes('not granted')) {
      return {
        ok: false,
        mensaje:
          'Sin permiso para usar la cámara o las fotos. Actívalo en los Ajustes del dispositivo (Vertey > Cámara / Fotos) y vuelve a intentarlo.',
      };
    }
    return { ok: false, mensaje: 'No se pudo obtener la foto. Inténtalo de nuevo.' };
  }
}
