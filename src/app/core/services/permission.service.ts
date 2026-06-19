import { computed, inject, Injectable } from '@angular/core';
import { UserSyncService } from './user-sync.service';
import { UsersService } from './users';
import { FirmRole } from '../../interfaces/member';
import {
  can as canPure,
  PERMISOS,
  MODULOS,
  CAPABILITIES,
  type Capability,
  type Modulo,
} from '../permissions/permissions';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly userSync = inject(UserSyncService);
  private readonly usersService = inject(UsersService);

  /** Matriz y catálogos expuestos para el tab "Permisos" (solo lectura). */
  readonly MODULOS = MODULOS;
  readonly CAPABILITIES = CAPABILITIES;
  readonly PERMISOS = PERMISOS;

  readonly currentMember = computed(() => {
    const uid = this.userSync.currentUser()?.id;
    if (!uid) return null;
    return this.usersService.members().find(m => m.userId === uid) ?? null;
  });

  readonly userRole = computed<FirmRole | null>(() => this.currentMember()?.role ?? null);
  readonly isSuperUser = this.userSync.isSuperUser;
  readonly isAdmin = computed(() => this.hasRole('Admin') || this.isSuperUser());

  /** API granular: ¿puede el usuario actual ejecutar `cap` en `modulo`? */
  can(modulo: Modulo, cap: Capability): boolean {
    return canPure(this.userRole(), this.isSuperUser(), modulo, cap);
  }

  /** Acceso al módulo = poder verlo. Alias usado por el route guard. */
  canAccess(modulo: Modulo): boolean {
    return this.can(modulo, 'ver');
  }

  hasRole(...roles: FirmRole[]): boolean {
    const role = this.userRole();
    return role !== null && roles.includes(role);
  }
}
