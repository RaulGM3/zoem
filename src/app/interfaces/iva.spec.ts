import { describe, it, expect } from 'vitest';
import { desglosarIva, TIPOS_IVA } from './iva';

describe('desglosarIva', () => {
  it('desglosa un total con IVA al 21% en base y cuota', () => {
    // 121 € total @ 21% → base 100, cuota 21
    expect(desglosarIva(121, 21, false)).toEqual({ baseImponible: 100, cuotaIva: 21 });
  });

  it('desglosa al 10%', () => {
    // 110 € @ 10% → base 100, cuota 10
    expect(desglosarIva(110, 10, false)).toEqual({ baseImponible: 100, cuotaIva: 10 });
  });

  it('desglosa al 4%', () => {
    // 104 € @ 4% → base 100, cuota 4
    expect(desglosarIva(104, 4, false)).toEqual({ baseImponible: 100, cuotaIva: 4 });
  });

  it('trata un suplido exento como base completa sin cuota', () => {
    expect(desglosarIva(50, 0, true)).toEqual({ baseImponible: 50, cuotaIva: 0 });
  });

  it('tipo 0 (no sujeto) tampoco genera cuota', () => {
    expect(desglosarIva(50, 0, false)).toEqual({ baseImponible: 50, cuotaIva: 0 });
  });

  it('redondea base y cuota a 2 decimales y conserva el total', () => {
    // 100 € @ 21% → base 82.64, cuota 17.36 (suma exacta = 100)
    const { baseImponible, cuotaIva } = desglosarIva(100, 21, false);
    expect(baseImponible).toBe(82.64);
    expect(cuotaIva).toBe(17.36);
    expect(baseImponible + cuotaIva).toBe(100);
  });

  it('expone los tipos de IVA vigentes en España', () => {
    expect(TIPOS_IVA).toEqual([21, 10, 4, 0]);
  });
});
