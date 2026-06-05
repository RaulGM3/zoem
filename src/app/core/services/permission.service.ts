import { computed, inject, Injectable } from '@angular/core';
import { UserSyncService } from './user-sync.service';
import { UsersService } from './users';
import { FirmRole } from '../../interfaces/member';

const MODULOS = [
  'Proyectos', 'Contactos', 'Facturación', 'Tesorería',
  'Documentos', 'Informes', 'Configuración',
];

const PERMISOS_MATRIZ: Record<string, Record<string, boolean>> = {
  'Proyectos':     { Admin: true,  Gestor: true,  Usuario: true,  Viewer: true  },
  'Contactos':     { Admin: true,  Gestor: true,  Usuario: true,  Viewer: true  },
  'Facturación':   { Admin: true,  Gestor: true,  Usuario: false, Viewer: true  },
  'Tesorería':     { Admin: true,  Gestor: true,  Usuario: false, Viewer: false },
  'Documentos':    { Admin: true,  Gestor: true,  Usuario: true,  Viewer: true  },
  'Informes':      { Admin: true,  Gestor: true,  Usuario: false, Viewer: true  },
  'Configuración': { Admin: true,  Gestor: false, Usuario: false, Viewer: false },
};

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly userSync = inject(UserSyncService);
  private readonly usersService = inject(UsersService);

  readonly MODULOS = MODULOS;
  readonly PERMISOS_MATRIZ = PERMISOS_MATRIZ;

  readonly currentMember = computed(() => {
    const email = this.userSync.currentUser()?.email;
    if (!email) return null;
    return this.usersService.members().find(m => m.userId === email) ?? null;
  });

  readonly userRole = computed<FirmRole | null>(() => this.currentMember()?.role ?? null);
  readonly isSuperUser = this.userSync.isSuperUser;
  readonly isAdmin = computed(() => this.hasRole('Admin') || this.isSuperUser());

  canAccess(modulo: string): boolean {
    if (this.isSuperUser()) return true;
    const role = this.userRole();
    if (!role) return false;
    return PERMISOS_MATRIZ[modulo]?.[role] ?? false;
  }

  hasRole(...roles: FirmRole[]): boolean {
    const role = this.userRole();
    return role !== null && roles.includes(role);
  }
}
