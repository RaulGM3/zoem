import { effect, inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { UserSyncService } from './user-sync.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import type { CustomRoleDef } from '../permissions/permissions';

/**
 * Roles custom de la empresa. Doc `companies/{cid}/settings/roles`.
 * Cada rol se ancla a un rol BASE (Gestor/Usuario/Viewer): eso es lo que
 * guarda el member en `role` y lo único que ven las security rules; el rol
 * custom aporta nombre propio y una matriz fina que refina en cliente.
 * Auto-suscrito como [[CompanyPermissionsService]]: `can()` lo necesita vivo.
 */
@Injectable({ providedIn: 'root' })
export class CustomRolesService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly userSync = inject(UserSyncService);

  readonly roles = signal<CustomRoleDef[]>([]);

  private unsub: Unsubscribe | null = null;

  constructor() {
    effect(() => {
      const companyId = this.companyService.activeCompany()?.id;
      this.unsub?.();
      this.unsub = null;
      this.roles.set([]);
      if (!companyId) return;
      this.unsub = onSnapshot(this.rolesRef(companyId), snap => {
        const data = snap.data() as { roles?: CustomRoleDef[] } | undefined;
        this.roles.set(data?.roles ?? []);
      });
    });
  }

  private rolesRef(companyId: string) {
    return doc(this.firestore, 'companies', companyId, 'settings', 'roles');
  }

  byId(id: string | null | undefined): CustomRoleDef | null {
    if (!id) return null;
    return this.roles().find(r => r.id === id) ?? null;
  }

  /** Crea o actualiza un rol (upsert por id). */
  async saveRole(role: CustomRoleDef): Promise<void> {
    const next = [...this.roles().filter(r => r.id !== role.id), role]
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    await this.persist(next);
  }

  /**
   * Elimina la definición del rol. Los miembros que lo tuvieran asignado
   * conservan su rol base (resolveCan ignora un customRoleId inexistente).
   */
  async deleteRole(id: string): Promise<void> {
    await this.persist(this.roles().filter(r => r.id !== id));
  }

  private async persist(roles: CustomRoleDef[]): Promise<void> {
    const companyId = this.companyService.activeCompany()?.id;
    if (!companyId) throw new Error('No active company');
    await setDoc(this.rolesRef(companyId), stripUndefinedDeep({
      roles,
      updatedAt: serverTimestamp(),
      updatedBy: this.userSync.currentUser()?.id ?? '',
    }));
  }
}
