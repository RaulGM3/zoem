import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { FirmRole } from '../interfaces/member';
import { PermissionService } from '../core/services/permission.service';
import { ToastService } from '../core/services/toast.service';

/**
 * Restringe una ruta a ciertos roles base. Se usa DESPUÉS de `permissionGuard` (que autentica y
 * carga los miembros): esta comprobación es síncrona y asume que el rol ya está resuelto.
 * Refleja la regla de firestore.rules (que es la que realmente protege los datos).
 */
export function rolGuard(...roles: FirmRole[]): CanActivateFn {
  return () => {
    const permission = inject(PermissionService);
    if (permission.hasRole(...roles) || permission.isSuperUser()) return true;
    inject(ToastService).info(`Esta sección es solo para ${roles.join(' y ')}.`, 'Acceso restringido');
    return inject(Router).createUrlTree(['/calendario']);
  };
}
