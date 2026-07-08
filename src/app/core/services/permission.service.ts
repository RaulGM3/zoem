import { computed, inject, Injectable } from '@angular/core';
import { UserSyncService } from './user-sync.service';
import { UsersService } from './users';
import { CompanyPermissionsService } from './company-permissions.service';
import { CustomRolesService } from './custom-roles.service';
import { CompanyMember, FIRM_ROLE_COLORS, FirmRole } from '../../interfaces/member';
import {
  resolveCan,
  effectiveMatrix,
  PERMISOS,
  MODULOS,
  CAPABILITIES,
  type Capability,
  type Modulo,
} from '../permissions/permissions';

/** Etiquetas amables por capacidad para mensajes de "sin permiso". */
const CAP_LABELS: Record<Capability, string> = {
  ver: 'ver',
  crear: 'crear elementos en',
  editar: 'editar en',
  eliminar: 'eliminar en',
};

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly userSync = inject(UserSyncService);
  private readonly usersService = inject(UsersService);
  private readonly companyPerms = inject(CompanyPermissionsService);
  private readonly customRoles = inject(CustomRolesService);

  /** Matriz base y catálogos, para el editor del tab "Permisos". */
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

  /** Matriz base + configuración de la empresa fusionadas (lo que rige de verdad). */
  readonly effectivePermisos = computed(() =>
    effectiveMatrix(this.companyPerms.companyMatrix() ?? undefined),
  );

  /** Definición del rol custom del usuario actual (null si usa un rol base). */
  readonly currentCustomRole = computed(() =>
    this.customRoles.byId(this.currentMember()?.customRoleId),
  );

  /**
   * API granular: ¿puede el usuario actual ejecutar `cap` en `modulo`?
   * Resuelve override individual > rol custom > matriz de empresa > base.
   * Al leer signals, cualquier computed que lo llame reacciona en vivo.
   */
  can(modulo: Modulo, cap: Capability): boolean {
    return resolveCan(
      this.userRole(),
      this.isSuperUser(),
      modulo,
      cap,
      this.companyPerms.companyMatrix() ?? undefined,
      this.currentMember()?.permissionOverrides,
      this.currentCustomRole()?.matrix,
    );
  }

  /** Nombre y color del rol a mostrar para un miembro (custom si lo tiene). */
  displayRole(member: CompanyMember): { label: string; colorClass: string } {
    const custom = this.customRoles.byId(member.customRoleId);
    if (custom) {
      return { label: custom.nombre, colorClass: 'bg-teal-100 text-teal-700' };
    }
    return {
      label: member.role,
      colorClass: FIRM_ROLE_COLORS[member.role] ?? 'bg-slate-100 text-slate-600',
    };
  }

  /** Acceso al módulo = poder verlo. Alias usado por el route guard. */
  canAccess(modulo: Modulo): boolean {
    return this.can(modulo, 'ver');
  }

  hasRole(...roles: FirmRole[]): boolean {
    const role = this.userRole();
    return role !== null && roles.includes(role);
  }

  /** Mensaje amable y consistente para toasts/estados de "sin permiso". */
  denyMessage(modulo: Modulo, cap: Capability): string {
    return `No tienes permiso para ${CAP_LABELS[cap]} ${modulo}. Puedes solicitárselo a tu administrador.`;
  }
}
