import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { qrUrl, soapEndpoint } from './endpoints';

describe('soapEndpoint', () => {
  it('S5.1 sandbox=true -> prewww1 (VerifactuSOAP)', () => {
    expect(soapEndpoint(true)).toBe('https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP');
  });

  it('S5.1 sandbox=false -> producción www1', () => {
    expect(soapEndpoint(false)).toBe(
      'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    );
  });

  it('S5.4 no usa los endpoints antiguos ni los de sello (prewww10/www10)', () => {
    const fuente = readFileSync(join(__dirname, 'endpoints.ts'), 'utf8');
    expect(fuente).not.toContain('/ws/SistemaVerifactu');
    expect(fuente).not.toContain('www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws');
    expect(fuente).not.toContain('prewww10');
    expect(fuente).not.toContain('www10');
    for (const sandbox of [true, false]) {
      expect(soapEndpoint(sandbox)).not.toContain('SistemaVerifactu');
      expect(soapEndpoint(sandbox)).not.toContain('www10');
    }
  });
});

describe('qrUrl', () => {
  const datos = { nif: '89890001K', numSerie: '12345678/G33', fecha: '01-01-2024', importe: '123.45' };

  it('S5.1 base sandbox (prewww2 ValidarQR)', () => {
    expect(qrUrl(true, datos)).toBe(
      'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678%2FG33&fecha=01-01-2024&importe=123.45',
    );
  });

  it('S5.1 base producción (www2 ValidarQR)', () => {
    expect(qrUrl(false, datos)).toBe(
      'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678%2FG33&fecha=01-01-2024&importe=123.45',
    );
  });

  it('S5.3 numserie con "/" se codifica como %2F', () => {
    expect(qrUrl(true, datos)).toContain('numserie=12345678%2FG33');
    expect(qrUrl(true, datos)).not.toContain('numserie=12345678/G33');
  });

  it('R5.2 codifica otros caracteres reservados y espacios', () => {
    const url = qrUrl(true, { ...datos, numSerie: 'A B&C#1' });
    expect(url).toContain('numserie=A%20B%26C%231');
  });

  it('S5.3 importe numérico siempre con 2 decimales', () => {
    expect(qrUrl(true, { ...datos, importe: 100 })).toContain('importe=100.00');
    expect(qrUrl(true, { ...datos, importe: 12.5 })).toContain('importe=12.50');
    expect(qrUrl(true, { ...datos, importe: '7' })).toContain('importe=7.00');
  });
});
