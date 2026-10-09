import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import type { CanMatchFn, Route } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import type { Modulo } from '../permissions/permissions';
import { PermissionService } from '../services/permission.service';
import { UsersService } from '../services/users';
import type { Funcion } from './catalogo';
import { PlanService } from './plan.service';

/**
 * Candado de PLAN (no de rol). No redirige: hace "match" de una ruta gemela que pinta
 * la vista previa bloqueada en el mismo sitio. Si el plan incluye la función, no hace
 * match y el router sigue con la ruta real.
 *
 * Orden de candados: el de rol va primero. Si el rol no puede ver el módulo devolvemos
 * false → cae a la ruta real, donde `permissionGuard` redirige a /sin-acceso como siempre.
 *
 * Es canMatch (no canActivate) porque solo canMatch puede elegir entre dos rutas con el
 * mismo path. Corre antes que los canActivate del padre, así que espera a la carga de auth.
 */
export function planBloqueado(funcion: Funcion, modulo?: Modulo): CanMatchFn {
  return async () => {
    const auth = inject(AuthService);
    const plan = inject(PlanService);
    const permission = inject(PermissionService);
    const users = inject(UsersService);
    const cargando$ = toObservable(auth.isLoading);

    if (auth.isLoading()) {
      await firstValueFrom(cargando$.pipe(filter((c) => !c), take(1)));
    }
    if (!auth.isAuthenticated()) return false;
    if (plan.tiene(funcion)) return false;
    if (modulo) {
      if (users.members().length === 0) await users.loadMembers();
      if (!permission.canAccess(modulo)) return false;
    }
    return true;
  };
}

/** Devuelve [rutaBloqueada, rutaReal] para extender con `...` en la tabla de rutas. */
export function rutaConPlan(ruta: Route, funcion: Funcion, modulo?: Modulo): Route[] {
  const bloqueada: Route = {
    path: ruta.path,
    canMatch: [planBloqueado(funcion, modulo)],
    data: { funcion },
    loadComponent: () =>
      import('../../components/pagina-bloqueada/pagina-bloqueada-ruta').then((m) => m.PaginaBloqueadaRutaComponent),
  };
  return [bloqueada, ruta];
}
