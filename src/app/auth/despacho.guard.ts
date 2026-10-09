import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { necesitaBienvenida } from '../core/autoservicio/necesita-bienvenida';
import { CompanyService } from '../core/services/company.service';
import { UserSyncService } from '../core/services/user-sync.service';
import { AuthService } from './auth.service';

/** Espera a que la sesión (y sus membresías) terminen de cargar y evalúa `decidir`. */
function tras<T>(decidir: () => T): T | ReturnType<typeof toObservable<T>> {
  const auth = inject(AuthService);
  if (!auth.isLoading()) return decidir();
  return toObservable(auth.isLoading).pipe(
    filter((cargando) => !cargando),
    take(1),
    map(() => decidir()),
  ) as never;
}

/** Layout principal: quien no pertenece a ningún despacho va al asistente de alta. */
export const requiereDespachoGuard: CanActivateFn = () => {
  const router = inject(Router);
  const company = inject(CompanyService);
  const user = inject(UserSyncService);
  return tras(() =>
    necesitaBienvenida({
      esSuperuser: user.isSuperUser(),
      membresias: company.myMemberships().length,
      empresaActiva: company.activeCompany() !== null,
    })
      ? router.createUrlTree(['/bienvenida'])
      : true,
  );
};

/** /bienvenida: solo para quien aún no tiene despacho. */
export const sinDespachoGuard: CanActivateFn = () => {
  const router = inject(Router);
  const company = inject(CompanyService);
  const user = inject(UserSyncService);
  return tras(() =>
    necesitaBienvenida({
      esSuperuser: user.isSuperUser(),
      membresias: company.myMemberships().length,
      empresaActiva: company.activeCompany() !== null,
    })
      ? true
      : router.createUrlTree(['/']),
  );
};
