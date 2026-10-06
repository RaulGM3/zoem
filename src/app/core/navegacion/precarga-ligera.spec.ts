import { describe, it, expect, vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import type { Route } from '@angular/router';
import { debePrecargar, PrecargaLigera } from './precarga-ligera';

describe('debePrecargar', () => {
  it('precarga una ruta normal con buena conexión', () => {
    expect(debePrecargar({ path: 'casos' }, { effectiveType: '4g' })).toBe(true);
  });

  it('precarga si el navegador no expone la conexión', () => {
    expect(debePrecargar({ path: 'casos' }, undefined)).toBe(true);
  });

  it('no precarga rutas marcadas con data.preload = false', () => {
    const ruta: Route = { path: 'pesada', data: { preload: false } };
    expect(debePrecargar(ruta, { effectiveType: '4g' })).toBe(false);
  });

  it('no precarga si el usuario activó el ahorro de datos', () => {
    expect(debePrecargar({ path: 'casos' }, { saveData: true, effectiveType: '4g' })).toBe(false);
  });

  it.each(['slow-2g', '2g'])('no precarga con conexión %s', (effectiveType) => {
    expect(debePrecargar({ path: 'casos' }, { effectiveType })).toBe(false);
  });
});

describe('PrecargaLigera', () => {
  it('llama a load cuando la ruta debe precargarse', async () => {
    const load = vi.fn(() => of('chunk'));
    const resultado = await firstValueFrom(new PrecargaLigera().preload({ path: 'casos' }, load));
    expect(load).toHaveBeenCalledOnce();
    expect(resultado).toBe('chunk');
  });

  it('no llama a load cuando la ruta está excluida', async () => {
    const load = vi.fn(() => of('chunk'));
    const resultado = await firstValueFrom(
      new PrecargaLigera().preload({ path: 'x', data: { preload: false } }, load),
    );
    expect(load).not.toHaveBeenCalled();
    expect(resultado).toBeNull();
  });
});
