import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, from, switchMap, take } from 'rxjs';
import { AuthService } from './auth.service';
import { PermissionService } from '../core/services/permission.service';
import { ToastService } from '../core/services/toast.service';
import { UsersService } from '../core/services/users';
import type { Modulo } from '../core/permissions/permissions';

export function permissionGuard(modulo: Modulo): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const permission = inject(PermissionService);
    const usersService = inject(UsersService);
    const toast = inject(ToastService);
    const router = inject(Router);

    const ensureAndCheck = async () => {
      if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
      if (usersService.members().length === 0) await usersService.loadMembers();
      if (permission.canAccess(modulo)) return true;
      toast.info(permission.denyMessage(modulo, 'ver'), 'Acceso restringido');
      return router.createUrlTree(['/sin-acceso', modulo]);
    };

    if (!auth.isLoading()) return from(ensureAndCheck());

    return toObservable(auth.isLoading).pipe(
      filter(loading => !loading),
      take(1),
      switchMap(() => from(ensureAndCheck()))
    );
  };
}
