import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoading()) {
    return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
  }

  return toObservable(auth.isLoading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() =>
      auth.isAuthenticated() ? true : router.createUrlTree(['/login'])
    )
  );
};
