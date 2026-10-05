import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { CapturaArchivoService, ACCEPT_FACTURA, ACCEPT_FOTO } from './captura-archivo.service';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));
vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: vi.fn() },
  CameraResultType: { Uri: 'uri', DataUrl: 'dataUrl', Base64: 'base64' },
  CameraSource: { Prompt: 'PROMPT', Camera: 'CAMERA', Photos: 'PHOTOS' },
}));

const archivo = (nombre: string, tipo: string, bytes = 10): File =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo });

describe('CapturaArchivoService (web)', () => {
  let svc: CapturaArchivoService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    svc = TestBed.inject(CapturaArchivoService);
  });

  it('expone los accept de los inputs (PDF + imágenes sin HEIC; foto solo imágenes)', () => {
    expect(ACCEPT_FACTURA).toBe('application/pdf,image/jpeg,image/png,image/webp');
    expect(ACCEPT_FOTO).toBe('image/jpeg,image/png,image/webp');
  });

  it.each([
    ['factura.pdf', 'application/pdf'],
    ['foto.jpg', 'image/jpeg'],
    ['foto.png', 'image/png'],
    ['foto.webp', 'image/webp'],
  ])('acepta %s (%s)', (nombre, tipo) => {
    const r = svc.validar(archivo(nombre, tipo));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.archivo.type).toBe(tipo);
  });

  it.each([
    ['IMG_0001.HEIC', 'image/heic'],
    ['IMG_0001.heif', 'image/heif'],
    ['IMG_0002.heic', ''],
  ])('rechaza HEIC/HEIF (%s) con un mensaje que explica qué hacer', (nombre, tipo) => {
    const r = svc.validar(archivo(nombre, tipo));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toMatch(/HEIC/);
  });

  it('rechaza formatos no soportados', () => {
    const r = svc.validar(archivo('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toMatch(/PDF|JPEG|PNG/);
  });

  it('rechaza archivos vacíos y demasiado grandes (15 MB)', () => {
    expect(svc.validar(archivo('a.pdf', 'application/pdf', 0)).ok).toBe(false);
    const grande = svc.validar(archivo('a.pdf', 'application/pdf', 15 * 1024 * 1024 + 1));
    expect(grande.ok).toBe(false);
    if (!grande.ok) expect(grande.mensaje).toMatch(/15/);
  });

  it('deduce el tipo por la extensión cuando el navegador no lo informa', () => {
    const r = svc.validar(archivo('Factura.PDF', ''));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.archivo.type).toBe('application/pdf');
  });
});

describe('CapturaArchivoService (nativo con @capacitor/camera)', () => {
  let svc: CapturaArchivoService;
  const getPhoto = vi.mocked(Camera.getPhoto);
  const fetchFalso = vi.fn();

  beforeEach(() => {
    TestBed.resetTestingModule();
    getPhoto.mockReset();
    fetchFalso.mockReset();
    vi.stubGlobal('fetch', fetchFalso);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    svc = TestBed.inject(CapturaArchivoService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  });

  const fotoOk = (): void => {
    getPhoto.mockResolvedValue({ webPath: 'capacitor://localhost/_capacitor_file_/foto.jpg', format: 'jpeg', saved: false });
    fetchFalso.mockResolvedValue({ ok: true, blob: async () => new Blob([new Uint8Array(2048)], { type: 'image/jpeg' }) });
  };

  it('esNativo refleja Capacitor.isNativePlatform()', () => {
    expect(svc.esNativo()).toBe(true);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    expect(svc.esNativo()).toBe(false);
  });

  it.each([
    ['camara', CameraSource.Camera],
    ['galeria', CameraSource.Photos],
  ] as const)('capturar(%s) pide la foto a la fuente correcta en JPEG y devuelve un File JPEG', async (origen, fuente) => {
    fotoOk();
    const r = await svc.capturar(origen);
    expect(getPhoto).toHaveBeenCalledWith(expect.objectContaining({ source: fuente, resultType: CameraResultType.Uri, correctOrientation: true }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.archivo.type).toBe('image/jpeg');
      expect(r.archivo.name).toMatch(/^factura-.*\.jpg$/);
      expect(r.archivo.size).toBe(2048);
    }
  });

  it('el usuario cancela: resultado cancelado, sin mensaje', async () => {
    getPhoto.mockRejectedValue(new Error('User cancelled photos app'));
    const r = await svc.capturar('camara');
    expect(r).toEqual({ ok: false, cancelado: true });
  });

  it.each(['User denied access to camera', 'User denied access to photos', 'Camera permission is not granted'])(
    'permiso denegado (%s): mensaje accesible que explica cómo darlo',
    async (msg) => {
      getPhoto.mockRejectedValue(new Error(msg));
      const r = await svc.capturar('galeria');
      expect(r.ok).toBe(false);
      if (!r.ok && !('cancelado' in r)) expect(r.mensaje).toMatch(/permiso.*Ajustes/i);
      else throw new Error('se esperaba mensaje');
    },
  );

  it('error desconocido: mensaje genérico, sin lanzar', async () => {
    getPhoto.mockRejectedValue(new Error('boom'));
    const r = await svc.capturar('camara');
    expect(r.ok).toBe(false);
    if (!r.ok && !('cancelado' in r)) expect(r.mensaje).toMatch(/No se pudo/);
  });

  it('si no se puede leer la foto devuelta: mensaje de error', async () => {
    getPhoto.mockResolvedValue({ webPath: 'x', format: 'jpeg', saved: false });
    fetchFalso.mockRejectedValue(new Error('net'));
    const r = await svc.capturar('camara');
    expect(r.ok).toBe(false);
  });

  it('pasa la foto por validar() (foto vacía rechazada)', async () => {
    getPhoto.mockResolvedValue({ webPath: 'x', format: 'jpeg', saved: false });
    fetchFalso.mockResolvedValue({ ok: true, blob: async () => new Blob([], { type: 'image/jpeg' }) });
    const r = await svc.capturar('camara');
    expect(r).toEqual({ ok: false, mensaje: 'El archivo está vacío.' });
  });
});
