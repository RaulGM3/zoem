import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CapturaArchivoService, ACCEPT_FACTURA, ACCEPT_FOTO } from './captura-archivo.service';

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
