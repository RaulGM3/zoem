import { describe, it, expect } from 'vitest';
import type { Route } from '@angular/router';
import { routes } from './app.routes';
import { CONFIGURACION_ROUTES } from './components/configuracion/configuracion.routes';
import { SECCIONES_CONFIG } from './core/configuracion/secciones';

const hijos = (): Route[] => routes.find((r) => r.path === '' && r.children)!.children!;
const ruta = (path: string): Route | undefined => hijos().find((r) => r.path === path);

describe('app.routes — Configuración', () => {
  it('/configuracion está protegida con guard en la ruta y en sus hijos', () => {
    const r = ruta('configuracion')!;
    expect(r.canActivate).toHaveLength(1);
    expect(r.canActivateChild).toHaveLength(1);
    expect(r.loadComponent).toBeDefined();
    expect(r.loadChildren).toBeDefined();
  });

  it('/usuarios redirige a /configuracion/usuarios (pathMatch full)', () => {
    const r = ruta('usuarios')!;
    expect(r.redirectTo).toBe('configuracion/usuarios');
    expect(r.pathMatch).toBe('full');
    expect(r.canActivate).toBeUndefined();
    expect(r.loadComponent).toBeUndefined();
  });

  it('hijos: índice + una ruta por sección del catálogo + comodín que vuelve a la lista', () => {
    const paths = CONFIGURACION_ROUTES.map((r) => r.path);
    expect(paths).toEqual(['', ...SECCIONES_CONFIG.map((s) => s.id), '**']);
    const comodin = CONFIGURACION_ROUTES.at(-1)!;
    expect(comodin.redirectTo).toBe('');
  });

  it('cada sección carga su componente de forma diferida', async () => {
    for (const r of CONFIGURACION_ROUTES.filter((x) => x.loadComponent)) {
      expect(await (r.loadComponent as () => Promise<unknown>)()).toBeDefined();
    }
  });
});
