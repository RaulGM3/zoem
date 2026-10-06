import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Storage } from '@angular/fire/storage';
import { CompanyLogoService } from './company-logo.service';
import { ClaimsSyncService } from './claims-sync.service';
import { CompanyService, type Company, type CompanyLogo } from './company.service';

const m = vi.hoisted(() => ({
  ref: vi.fn((_s: unknown, path: string) => ({ fullPath: path })),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('@angular/fire/storage', () => ({
  Storage: class MockStorage {},
  ref: (...a: [unknown, string]) => m.ref(...a),
  uploadBytes: (...a: unknown[]) => m.uploadBytes(...a),
  getDownloadURL: (...a: unknown[]) => m.getDownloadURL(...a),
  deleteObject: (...a: unknown[]) => m.deleteObject(...a),
}));

const LOGO: CompanyLogo = {
  path: 'companies/c1/branding/logo', url: 'https://x/logo', contentType: 'image/png', updatedAt: '2026-01-01T00:00:00.000Z',
};

type Interno = {
  descargar: (url: string) => Promise<Blob>;
  aDataUrl: (blob: Blob) => Promise<string>;
  medir: (blob: Blob) => Promise<{ w: number; h: number }>;
};

describe('CompanyLogoService', () => {
  let svc: CompanyLogoService;
  let updateCompany: ReturnType<typeof vi.fn>;
  let removeCompanyLogo: ReturnType<typeof vi.fn>;
  let sync: ReturnType<typeof vi.fn>;
  const company = { id: 'c1', name: 'Acme', slug: 'a', isActive: true } as Company;

  beforeEach(() => {
    m.ref.mockClear();
    m.uploadBytes.mockReset().mockResolvedValue({});
    m.getDownloadURL.mockReset().mockResolvedValue('https://x/logo');
    m.deleteObject.mockReset().mockResolvedValue(undefined);
    updateCompany = vi.fn().mockResolvedValue(undefined);
    removeCompanyLogo = vi.fn().mockResolvedValue(undefined);
    sync = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: Storage, useValue: {} },
        { provide: ClaimsSyncService, useValue: { sync } },
        { provide: CompanyService, useValue: { activeCompany: () => company, updateCompany, removeCompanyLogo } },
      ],
    });
    svc = TestBed.inject(CompanyLogoService);
  });

  const png = (size = 100) => new File([new Uint8Array(size)], 'logo.png', { type: 'image/png' });

  describe('subir', () => {
    it('archivo inválido: devuelve error y no toca Storage ni Firestore', async () => {
      const svgFile = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
      const r = await svc.subir(svgFile);
      expect(r).toEqual({ ok: false, error: 'Formato no admitido (PNG o JPG)' });
      expect(m.uploadBytes).not.toHaveBeenCalled();
      expect(updateCompany).not.toHaveBeenCalled();
    });

    it('sube a branding/logo con contentType y guarda el objeto logo', async () => {
      const file = png();
      const r = await svc.subir(file);

      expect(m.ref).toHaveBeenCalledWith(expect.anything(), 'companies/c1/branding/logo');
      expect(m.uploadBytes).toHaveBeenCalledWith(
        { fullPath: 'companies/c1/branding/logo' }, file, expect.objectContaining({ contentType: 'image/png' }),
      );
      expect(updateCompany).toHaveBeenCalledWith('c1', {
        logo: {
          path: 'companies/c1/branding/logo', url: 'https://x/logo', contentType: 'image/png',
          updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        },
      });
      expect(r.ok).toBe(true);
    });

    it('storage/unauthorized: refresca claims y reintenta una vez', async () => {
      m.uploadBytes.mockRejectedValueOnce({ code: 'storage/unauthorized' });
      const r = await svc.subir(png());
      expect(sync).toHaveBeenCalledWith('c1');
      expect(m.uploadBytes).toHaveBeenCalledTimes(2);
      expect(r.ok).toBe(true);
    });

    it('sigue sin autorización tras el reintento: propaga el error (solo 2 intentos)', async () => {
      m.uploadBytes.mockRejectedValue({ code: 'storage/unauthorized' });
      await expect(svc.subir(png())).rejects.toMatchObject({ code: 'storage/unauthorized' });
      expect(m.uploadBytes).toHaveBeenCalledTimes(2);
      expect(updateCompany).not.toHaveBeenCalled();
    });

    it('otros errores no reintentan', async () => {
      m.uploadBytes.mockRejectedValue({ code: 'storage/canceled' });
      await expect(svc.subir(png())).rejects.toBeDefined();
      expect(sync).not.toHaveBeenCalled();
      expect(m.uploadBytes).toHaveBeenCalledTimes(1);
    });
  });

  describe('quitar', () => {
    it('quita el campo y borra el blob', async () => {
      await svc.quitar();
      expect(removeCompanyLogo).toHaveBeenCalledWith('c1');
      expect(m.deleteObject).toHaveBeenCalledWith({ fullPath: 'companies/c1/branding/logo' });
    });

    it('ignora storage/object-not-found', async () => {
      m.deleteObject.mockRejectedValue({ code: 'storage/object-not-found' });
      await expect(svc.quitar()).resolves.toBeUndefined();
    });

    it('propaga otros errores de borrado', async () => {
      m.deleteObject.mockRejectedValue({ code: 'storage/unauthorized' });
      await expect(svc.quitar()).rejects.toBeDefined();
    });
  });

  describe('cargarDataUrl', () => {
    let descargar: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      descargar = vi.fn(async () => new Blob(['x'], { type: 'image/png' }));
      const i = svc as unknown as Interno;
      i.descargar = descargar as unknown as Interno['descargar'];
      i.aDataUrl = async () => 'data:image/png;base64,AAAA';
      i.medir = async () => ({ w: 400, h: 100 });
    });

    it('devuelve dataUrl, formato y dimensiones', async () => {
      expect(await svc.cargarDataUrl(LOGO)).toEqual({ dataUrl: 'data:image/png;base64,AAAA', format: 'PNG', w: 400, h: 100 });
    });

    it('formato JPEG para image/jpeg', async () => {
      const r = await svc.cargarDataUrl({ ...LOGO, contentType: 'image/jpeg' });
      expect(r?.format).toBe('JPEG');
    });

    it('caché por path@updatedAt: descarga una sola vez', async () => {
      await svc.cargarDataUrl(LOGO);
      await svc.cargarDataUrl({ ...LOGO });
      expect(descargar).toHaveBeenCalledTimes(1);
      await svc.cargarDataUrl({ ...LOGO, updatedAt: '2026-02-02T00:00:00.000Z' });
      expect(descargar).toHaveBeenCalledTimes(2);
    });

    it('fallo: devuelve null, avisa y no cachea', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      descargar.mockRejectedValueOnce(new Error('cors'));
      expect(await svc.cargarDataUrl(LOGO)).toBeNull();
      expect(warn).toHaveBeenCalled();
      expect(await svc.cargarDataUrl(LOGO)).not.toBeNull();
      expect(descargar).toHaveBeenCalledTimes(2);
    });
  });
});
