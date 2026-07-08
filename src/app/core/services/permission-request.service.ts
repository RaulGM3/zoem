import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { ErrorService } from './error.service';
import { PermissionService } from './permission.service';
import { UsersService } from './users';
import { UserSyncService } from './user-sync.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import type { Capability, Modulo, UserPermissionOverrides } from '../permissions/permissions';
import type { PermissionRequest } from '../../interfaces/permission-request.interface';

/**
 * Solicitudes de permiso al admin. Colección `companies/{cid}/permission_requests`.
 * Nunca se borran: aprobada/rechazada queda como registro. Aprobar aplica el
 * override individual al member y resuelve la solicitud.
 */
@Injectable({ providedIn: 'root' })
export class PermissionRequestService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly errorService = inject(ErrorService);
  private readonly permissionService = inject(PermissionService);
  private readonly usersService = inject(UsersService);
  private readonly userSync = inject(UserSyncService);

  readonly requests = signal<PermissionRequest[]>([]);

  readonly pendientes = computed(() => this.requests().filter(r => r.estado === 'pendiente'));
  readonly misSolicitudes = computed(() => {
    const uid = this.userSync.currentUser()?.id;
    return uid ? this.requests().filter(r => r.userId === uid) : [];
  });

  private unsub: Unsubscribe | null = null;

  constructor() {
    effect(() => {
      const companyId = this.companyService.activeCompany()?.id;
      const uid = this.userSync.currentUser()?.id;
      const isAdmin = this.permissionService.isAdmin();
      this.unsub?.();
      this.unsub = null;
      this.requests.set([]);
      if (!companyId || !uid) return;
      // Las rules solo dejan al admin listar todo; el resto solo lo suyo.
      const q = isAdmin
        ? query(this.requestsRef(companyId), orderBy('createdAt', 'desc'))
        : query(this.requestsRef(companyId), where('userId', '==', uid), orderBy('createdAt', 'desc'));
      this.unsub = onSnapshot(
        q,
        snap => this.requests.set(snap.docs.map(d => ({ id: d.id, ...d.data() }) as PermissionRequest)),
        () => this.requests.set([]),
      );
    });
  }

  private requestsRef(companyId: string) {
    return collection(this.firestore, 'companies', companyId, 'permission_requests');
  }

  /** ¿Ya hay una solicitud pendiente del usuario actual para este módulo+capacidad? */
  hasPending(modulo: Modulo, capability: Capability): boolean {
    return this.misSolicitudes().some(
      r => r.estado === 'pendiente' && r.modulo === modulo && r.capability === capability,
    );
  }

  async request(modulo: Modulo, capability: Capability, motivo?: string): Promise<void> {
    const companyId = this.companyService.activeCompany()?.id;
    const user = this.userSync.currentUser();
    if (!companyId || !user) return;
    if (this.hasPending(modulo, capability)) return;
    await addDoc(this.requestsRef(companyId), stripUndefinedDeep({
      companyId,
      userId: user.id,
      userNombre: user.displayName ?? user.email ?? 'Alguien',
      modulo,
      capability,
      ...(motivo ? { motivo } : {}),
      estado: 'pendiente',
      createdAt: serverTimestamp(),
    }));
  }

  /** Aprueba: aplica el override al member y marca la solicitud como aprobada. */
  async approve(req: PermissionRequest): Promise<void> {
    const member = this.usersService.members().find(m => m.userId === req.userId);
    if (member) {
      const overrides: UserPermissionOverrides = structuredClone(member.permissionOverrides ?? {});
      (overrides[req.modulo] ??= {})[req.capability] = true;
      await this.usersService.updateMember(member.id, { permissionOverrides: overrides });
    }
    await this.resolve(req, 'aprobada');
  }

  async reject(req: PermissionRequest): Promise<void> {
    await this.resolve(req, 'rechazada');
  }

  private async resolve(req: PermissionRequest, estado: 'aprobada' | 'rechazada'): Promise<void> {
    const companyId = this.companyService.activeCompany()?.id;
    const user = this.userSync.currentUser();
    if (!companyId || !user) return;
    try {
      await updateDoc(doc(this.requestsRef(companyId), req.id), stripUndefinedDeep({
        estado,
        resolvedBy: user.id,
        resolvedByNombre: user.displayName ?? user.email ?? '',
        resolvedAt: serverTimestamp(),
      }));
    } catch (err) {
      void this.errorService.log(err, {
        serviceName: 'PermissionRequestService',
        methodName: 'resolve',
      });
      throw err;
    }
  }
}
