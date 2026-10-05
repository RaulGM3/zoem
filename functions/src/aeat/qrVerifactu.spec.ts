import { describe, it, expect } from 'vitest';
import { qrUrl } from './endpoints';
import { parseQrVerifactu } from './qrVerifactu';

const BASE = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR';
const ok = (url: string) => {
  const r = parseQrVerifactu(url);
  if (!r.ok) throw new Error(r.motivo);
  return r.datos;
};

describe('parseQrVerifactu (espejo de src/app/core/facturas-recibidas/qr-verifactu.ts)', () => {
  it('acepta sandbox y producción, Verifactu y NoVerifactu', () => {
    expect(ok(`${BASE}?nif=B12345674&numserie=A-1&fecha=01-02-2026&importe=10.5`)).toMatchObject({
      sandbox: true,
      noVerifactu: false,
      fechaIso: '2026-02-01',
      importe: 10.5,
    });
    const prod = ok('https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=B1&numserie=X&fecha=31-12-2026&importe=1');
    expect(prod).toMatchObject({ sandbox: false, noVerifactu: true });
  });

  it('reconstruye la URL canónica (importe 2 decimales, parámetros extra descartados)', () => {
    const d = ok(`${BASE}?nif=B1&numserie=A%2F1&fecha=01-02-2026&importe=10.5`);
    expect(d.url).toBe('https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B1&numserie=A%2F1&fecha=01-02-2026&importe=10.50');
    const conBasura = ok(`${BASE}?nif=B1&numserie=A&fecha=01-02-2026&importe=1&evil=http://x`);
    expect(conBasura.url).not.toContain('evil');
  });

  it('es consistente con endpoints.qrUrl', () => {
    const url = qrUrl(true, { nif: 'B1', numSerie: 'A 1', fecha: '01-02-2026', importe: 3 });
    expect(ok(url).url).toBe(url);
  });

  it.each([
    ['http (no https)', 'http://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B1&numserie=A&fecha=01-02-2026&importe=1'],
    ['host ajeno', 'https://evil.example.com/wlpl/TIKE-CONT/ValidarQR?nif=B1&numserie=A&fecha=01-02-2026&importe=1'],
    ['subdominio engañoso', 'https://prewww2.aeat.es.evil.com/wlpl/TIKE-CONT/ValidarQR?nif=B1&numserie=A&fecha=01-02-2026&importe=1'],
    ['credenciales en la URL', 'https://u:p@prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B1&numserie=A&fecha=01-02-2026&importe=1'],
    ['puerto', 'https://prewww2.aeat.es:8443/wlpl/TIKE-CONT/ValidarQR?nif=B1&numserie=A&fecha=01-02-2026&importe=1'],
    ['ruta ajena', 'https://prewww2.aeat.es/otra/ruta?nif=B1&numserie=A&fecha=01-02-2026&importe=1'],
    ['ruta con prefijo', 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR/../x?nif=B1&numserie=A&fecha=01-02-2026&importe=1'],
    ['parámetro repetido', `${BASE}?nif=B1&nif=B2&numserie=A&fecha=01-02-2026&importe=1`],
    ['falta parámetro', `${BASE}?nif=B1&numserie=A&importe=1`],
    ['fecha inválida', `${BASE}?nif=B1&numserie=A&fecha=31-02-2026&importe=1`],
    ['importe inválido', `${BASE}?nif=B1&numserie=A&fecha=01-02-2026&importe=1,5`],
    ['no es URL', 'esto no es una url'],
  ])('rechaza: %s', (_n, url) => {
    expect(parseQrVerifactu(url).ok).toBe(false);
  });
});
