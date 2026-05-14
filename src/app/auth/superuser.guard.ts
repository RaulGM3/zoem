import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';
import { UserSyncService } from '../core/services/user-sync.service';

export const superUserGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const userSync = inject(UserSyncService);
  const router = inject(Router);

  if (!auth.isLoading()) {
    if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
    return userSync.isSuperUser() ? true : router.createUrlTree(['/']);
  }

  return toObservable(auth.isLoading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() => {
      if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
      return userSync.isSuperUser() ? true : router.createUrlTree(['/']);
    })
  );
};
