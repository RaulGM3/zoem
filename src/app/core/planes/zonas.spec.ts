import { describe, expect, it } from 'vitest';
import { esZonaValida, ZONA_POR_DEFECTO } from './periodo';
import { ZONAS_COMUNES, opcionesZona, zonaDelNavegador } from './zonas';

describe('ZONAS_COMUNES', () => {
  it('todas son IANA válidas, sin duplicados, con etiqueta, e incluyen España y Latinoamérica', () => {
    const valores = ZONAS_COMUNES.map((z) => z.valor);
    expect(new Set(valores).size).toBe(valores.length);
    for (const z of ZONAS_COMUNES) {
      expect(esZonaValida(z.valor), z.valor).toBe(true);
      expect(z.etiqueta.length).toBeGreaterThan(2);
    }
    for (const v of ['Europe/Madrid', 'Atlantic/Canary', 'America/Mexico_City', 'America/Bogota', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Puerto_Rico']) {
      expect(valores, v).toContain(v);
    }
  });
});

describe('zonaDelNavegador', () => {
  it('devuelve una zona válida (la del navegador o Europe/Madrid)', () => {
    expect(esZonaValida(zonaDelNavegador())).toBe(true);
  });
  it('si Intl falla o devuelve algo inválido, Europe/Madrid', () => {
    expect(zonaDelNavegador(() => 'Mars/Olympus')).toBe(ZONA_POR_DEFECTO);
    expect(zonaDelNavegador(() => { throw new Error('x'); })).toBe(ZONA_POR_DEFECTO);
    expect(zonaDelNavegador(() => 'America/Lima')).toBe('America/Lima');
  });
});

describe('opcionesZona', () => {
  it('añade la zona actual si no está en la lista común (p. ej. America/Cancun)', () => {
    const o = opcionesZona('America/Cancun');
    expect(o.map((z) => z.valor)).toContain('America/Cancun');
    expect(o.length).toBe(ZONAS_COMUNES.length + 1);
  });
  it('no duplica una que ya está', () => {
    expect(opcionesZona('Europe/Madrid').length).toBe(ZONAS_COMUNES.length);
  });
});
