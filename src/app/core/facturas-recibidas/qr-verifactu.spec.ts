import { describe, it, expect } from 'vitest';
import { contrastarQr, parseQrVerifactu, type DatosQrFactura } from './qr-verifactu';

const PROD = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR';
const SANDBOX = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR';
const query = '?nif=B12345674&numserie=F-001&fecha=02-04-2026&importe=121.00';

describe('parseQrVerifactu', () => {
  it('acepta ValidarQR de producción y de pruebas', () => {
    for (const [base, sandbox] of [[PROD, false], [SANDBOX, true]] as const) {
      const r = parseQrVerifactu(base + query);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.datos).toMatchObject({
        nif: 'B12345674',
        numserie: 'F-001',
        fecha: '02-04-2026',
        fechaIso: '2026-04-02',
        importe: 121,
        noVerifactu: false,
        sandbox,
      });
    }
  });

  it('acepta ValidarQRNoVerifactu y lo marca', () => {
    const r = parseQrVerifactu(PROD + 'NoVerifactu' + query);
    expect(r.ok && r.datos.noVerifactu).toBe(true);
  });

  it('reconstruye la URL canónica (descarta parámetros extra y codifica el número)', () => {
    const r = parseQrVerifactu(`${PROD}?nif=B12345674&numserie=${encodeURIComponent('A/1 2')}&fecha=02-04-2026&importe=5.5&evil=1`);
    expect(r.ok && r.datos.url).toBe(`${PROD}?nif=B12345674&numserie=A%2F1%202&fecha=02-04-2026&importe=5.50`);
  });

  it('tolera espacios alrededor', () => {
    expect(parseQrVerifactu('  ' + PROD + query + '\n').ok).toBe(true);
  });

  it.each([
    ['http plano', 'http://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR' + query],
    ['host ajeno', 'https://evil.example.com/wlpl/TIKE-CONT/ValidarQR' + query],
    ['subdominio engañoso', 'https://www2.agenciatributaria.gob.es.evil.com/wlpl/TIKE-CONT/ValidarQR' + query],
    ['credenciales en la URL', 'https://user:pw@www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR' + query],
    ['puerto', 'https://www2.agenciatributaria.gob.es:8443/wlpl/TIKE-CONT/ValidarQR' + query],
    ['ruta ajena', 'https://www2.agenciatributaria.gob.es/otra/ruta' + query],
    ['ruta con prefijo parecido', 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRX' + query],
    ['otro host AEAT (SOAP)', 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR' + query],
    ['texto cualquiera', 'hola'],
    ['vacío', ''],
    ['javascript:', 'javascript:alert(1)'],
    ['sin nif', PROD + '?numserie=F-001&fecha=02-04-2026&importe=1.00'],
    ['sin numserie', PROD + '?nif=B12345674&fecha=02-04-2026&importe=1.00'],
    ['numserie > 60', PROD + `?nif=B12345674&numserie=${'A'.repeat(61)}&fecha=02-04-2026&importe=1.00`],
    ['fecha ISO', PROD + '?nif=B12345674&numserie=F&fecha=2026-04-02&importe=1.00'],
    ['fecha imposible', PROD + '?nif=B12345674&numserie=F&fecha=31-02-2026&importe=1.00'],
    ['importe con coma', PROD + '?nif=B12345674&numserie=F&fecha=02-04-2026&importe=1,00'],
    ['importe no numérico', PROD + '?nif=B12345674&numserie=F&fecha=02-04-2026&importe=abc'],
    ['parámetro duplicado', PROD + query + '&nif=A58818501'],
  ])('rechaza: %s', (_n, url) => {
    expect(parseQrVerifactu(url).ok).toBe(false);
  });
});

describe('contrastarQr', () => {
  const qr: DatosQrFactura = { nif: 'B12345674', numserie: 'F-001', fechaIso: '2026-04-02', importe: 121 };
  const form = { nif: 'B12345674', numero: 'F-001', fechaExpedicion: '2026-04-02', total: 121 };

  it('sin diferencias devuelve lista vacía', () => {
    expect(contrastarQr(qr, form)).toEqual([]);
  });

  it('normaliza NIF (ES, guiones, minúsculas) y número (espacios, mayúsculas)', () => {
    expect(contrastarQr(qr, { ...form, nif: 'es-b12345674', numero: ' f-001 ' })).toEqual([]);
  });

  it('tolera 0,01 de diferencia en el total', () => {
    expect(contrastarQr(qr, { ...form, total: 121.01 })).toEqual([]);
  });

  it('señala cada campo distinto', () => {
    const d = contrastarQr(qr, { nif: 'A58818501', numero: 'F-002', fechaExpedicion: '2026-04-03', total: 130 });
    expect(d).toHaveLength(4);
    expect(d.join(' ')).toMatch(/NIF/);
    expect(d.join(' ')).toMatch(/número/i);
    expect(d.join(' ')).toMatch(/fecha/i);
    expect(d.join(' ')).toMatch(/total|importe/i);
  });

  it('ignora los campos del formulario que aún están vacíos', () => {
    expect(contrastarQr(qr, { nif: '', numero: '', fechaExpedicion: '', total: Number.NaN })).toEqual([]);
  });
});
