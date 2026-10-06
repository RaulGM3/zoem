import { inject, Injectable } from '@angular/core';
import { Storage, deleteObject, getDownloadURL, ref, uploadBytes } from '@angular/fire/storage';
import { validarLogo } from '../configuracion/logo';
import { ClaimsSyncService } from './claims-sync.service';
import { CompanyService, type CompanyLogo, type LogoContentType } from './company.service';

export type ResultadoSubidaLogo = { ok: true; logo: CompanyLogo } | { ok: false; error: string };

export interface LogoCargado {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  /** Dimensiones en px. */
  w: number;
  h: number;
}

const codigoDe = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;

@Injectable({ providedIn: 'root' })
export class CompanyLogoService {
  private readonly storage = inject(Storage);
  private readonly companyService = inject(CompanyService);
  private readonly claimsSync = inject(ClaimsSyncService);

  private readonly cache = new Map<string, LogoCargado>();

  /** Valida, sube a companies/{cid}/branding/logo y guarda company.logo. Los errores de Storage se propagan. */
  async subir(file: File): Promise<ResultadoSubidaLogo> {
    const valido = validarLogo(file);
    if (!valido.ok) return valido;

    const cid = this.companyActivaId();
    const path = `companies/${cid}/branding/logo`;
    const storageRef = ref(this.storage, path);
    const contentType = file.type as LogoContentType;
    const opciones = { contentType, cacheControl: 'public,max-age=3600' };

    try {
      await uploadBytes(storageRef, file, opciones);
    } catch (err) {
      if (codigoDe(err) !== 'storage/unauthorized') throw err;
      // Claims viejos en el token: refrescar y reintentar una única vez.
      await this.claimsSync.sync(cid);
      await uploadBytes(storageRef, file, opciones);
    }

    const url = await getDownloadURL(storageRef);
    const logo: CompanyLogo = { path, url, contentType, updatedAt: new Date().toISOString() };
    await this.companyService.updateCompany(cid, { logo });
    return { ok: true, logo };
  }

  /** Quita el campo logo y borra el blob (si ya no existe, se ignora). */
  async quitar(): Promise<void> {
    const cid = this.companyActivaId();
    await this.companyService.removeCompanyLogo(cid);
    try {
      await deleteObject(ref(this.storage, `companies/${cid}/branding/logo`));
    } catch (err) {
      if (codigoDe(err) !== 'storage/object-not-found') throw err;
    }
  }

  /** Descarga el logo para incrustarlo en el PDF. Cacheado por path@updatedAt; ante cualquier fallo devuelve null (sin cachear). */
  async cargarDataUrl(logo: CompanyLogo): Promise<LogoCargado | null> {
    const clave = `${logo.path}@${logo.updatedAt}`;
    const enCache = this.cache.get(clave);
    if (enCache) return enCache;
    try {
      const blob = await this.descargar(logo.url);
      const [dataUrl, dim] = await Promise.all([this.aDataUrl(blob), this.medir(blob)]);
      const cargado: LogoCargado = {
        dataUrl,
        format: logo.contentType === 'image/jpeg' ? 'JPEG' : 'PNG',
        w: dim.w,
        h: dim.h,
      };
      this.cache.set(clave, cargado);
      return cargado;
    } catch (err) {
      console.warn('[logo] no se pudo cargar el logo para el PDF:', err);
      return null;
    }
  }

  private companyActivaId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  protected async descargar(url: string): Promise<Blob> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  }

  protected aDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  protected async medir(blob: Blob): Promise<{ w: number; h: number }> {
    const bmp = await createImageBitmap(blob);
    const dim = { w: bmp.width, h: bmp.height };
    bmp.close();
    return dim;
  }
}
