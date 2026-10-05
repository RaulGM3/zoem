import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import QRCode from 'qrcode';
import { QR_DECODE_PORTS, QrDecodeService, leerQrDePixeles, type PixelesQr, type QrDecodePorts } from './qr-decode.service';

const URL_OK =
  'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B12345674&numserie=F-001&fecha=02-04-2026&importe=121.00';

/** Rasteriza un QR real (módulos de `qrcode`) a RGBA con zona de silencio, sin canvas. */
function pixelesDeQr(texto: string, escala = 6, margen = 4): PixelesQr {
  const qr = QRCode.create(texto, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const lado = (n + margen * 2) * escala;
  const data = new Uint8ClampedArray(lado * lado * 4).fill(255);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(y, x)) continue;
      for (let dy = 0; dy < escala; dy++) {
        for (let dx = 0; dx < escala; dx++) {
          const i = (((y + margen) * escala + dy) * lado + (x + margen) * escala + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: lado, height: lado };
}

describe('leerQrDePixeles (jsQR real)', () => {
  it('decodifica un QR de la AEAT', async () => {
    expect(await leerQrDePixeles(pixelesDeQr(URL_OK))).toBe(URL_OK);
  });

  it('imagen sin QR devuelve null', async () => {
    const blanco: PixelesQr = { data: new Uint8ClampedArray(100 * 100 * 4).fill(255), width: 100, height: 100 };
    expect(await leerQrDePixeles(blanco)).toBeNull();
  });
});

describe('QrDecodeService', () => {
  let ports: { [K in keyof QrDecodePorts]: ReturnType<typeof vi.fn> };
  let service: QrDecodeService;
  const pix: PixelesQr = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
  const pdf = new File([new Uint8Array(3)], 'f.pdf', { type: 'application/pdf' });
  const png = new File([new Uint8Array(3)], 'f.png', { type: 'image/png' });

  beforeEach(() => {
    ports = {
      imagenAPixeles: vi.fn().mockResolvedValue(pix),
      pdfAPixeles: vi.fn().mockResolvedValue(pix),
      leerQr: vi.fn().mockResolvedValue(URL_OK),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: QR_DECODE_PORTS, useValue: ports }] });
    service = TestBed.inject(QrDecodeService);
  });

  it('una imagen se rasteriza con el puerto de imagen y devuelve el QR parseado', async () => {
    const r = await service.leer(png);
    expect(ports.imagenAPixeles).toHaveBeenCalledWith(png);
    expect(ports.pdfAPixeles).not.toHaveBeenCalled();
    expect(r?.ok && r.datos).toMatchObject({ nif: 'B12345674', numserie: 'F-001', importe: 121, sandbox: true });
  });

  it('un PDF usa el puerto de PDF (página 1)', async () => {
    await service.leer(pdf);
    expect(ports.pdfAPixeles).toHaveBeenCalledWith(pdf);
    expect(ports.imagenAPixeles).not.toHaveBeenCalled();
  });

  it('sin QR devuelve null (estado sin_qr, sin aviso)', async () => {
    ports.leerQr.mockResolvedValue(null);
    expect(await service.leer(png)).toBeNull();
  });

  it('un QR que no es de la AEAT devuelve ok:false con motivo', async () => {
    ports.leerQr.mockResolvedValue('https://evil.example.com/x');
    const r = await service.leer(png);
    expect(r?.ok).toBe(false);
  });

  it('nunca lanza: un fallo de decodificación equivale a "sin QR"', async () => {
    ports.imagenAPixeles.mockRejectedValue(new Error('canvas'));
    expect(await service.leer(png)).toBeNull();
    ports.pdfAPixeles.mockRejectedValue(new Error('worker'));
    expect(await service.leer(pdf)).toBeNull();
  });

  it('tipos no soportados devuelven null sin tocar los puertos', async () => {
    expect(await service.leer(new File([], 'a.txt', { type: 'text/plain' }))).toBeNull();
    expect(ports.imagenAPixeles).not.toHaveBeenCalled();
    expect(ports.pdfAPixeles).not.toHaveBeenCalled();
  });
});
