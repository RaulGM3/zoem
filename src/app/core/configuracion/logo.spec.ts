import { describe, it, expect } from 'vitest';
import { LOGO_MAX_BYTES, encajarLogo, validarLogo } from './logo';

describe('validarLogo', () => {
  it('acepta png y jpeg', () => {
    expect(validarLogo({ type: 'image/png', size: 1000 })).toEqual({ ok: true });
    expect(validarLogo({ type: 'image/jpeg', size: 1000 })).toEqual({ ok: true });
  });

  it('rechaza svg, webp y gif', () => {
    for (const type of ['image/svg+xml', 'image/webp', 'image/gif']) {
      expect(validarLogo({ type, size: 10 })).toEqual({ ok: false, error: 'Formato no admitido (PNG o JPG)' });
    }
  });

  it('rechaza más de 1 MB y acepta exactamente 1 MB', () => {
    expect(validarLogo({ type: 'image/png', size: LOGO_MAX_BYTES + 1 })).toEqual({ ok: false, error: 'Máximo 1 MB' });
    expect(validarLogo({ type: 'image/png', size: LOGO_MAX_BYTES })).toEqual({ ok: true });
  });
});

describe('encajarLogo', () => {
  it('apaisado 400x100 -> 40x10', () => {
    expect(encajarLogo(400, 100)).toEqual({ w: 40, h: 10 });
  });
  it('alto 100x200 -> 8x16', () => {
    expect(encajarLogo(100, 200)).toEqual({ w: 8, h: 16 });
  });
  it('cuadrado 100x100 -> 16x16', () => {
    expect(encajarLogo(100, 100)).toEqual({ w: 16, h: 16 });
  });
  it('0 / NaN / negativos -> null', () => {
    expect(encajarLogo(0, 100)).toBeNull();
    expect(encajarLogo(100, 0)).toBeNull();
    expect(encajarLogo(NaN, 100)).toBeNull();
    expect(encajarLogo(-5, 100)).toBeNull();
  });
});
