import { computed, inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import {
  CompanyMember,
  FirmRole,
  FirmRoleConfig,
  FIRM_ROLE_CONFIGS,
  MemberEstado,
  normalizeFirmRole,
} from '../../interfaces/member';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);

  readonly members = signal<CompanyMember[]>([]);
  readonly isLoading = signal(false);

  readonly activos = computed(() => this.members().filter(m => m.estado === 'activo').length);
  readonly pendientes = computed(() => this.members().filter(m => m.estado === 'pendiente').length);
  readonly countByRole = computed<Record<FirmRole, number>>(() => {
    const counts: Record<FirmRole, number> = { Admin: 0, Gestor: 0, Usuario: 0, Viewer: 0 };
    for (const m of this.members()) {
      counts[m.role] = (counts[m.role] ?? 0) + 1;
    }
    return counts;
  });

  async loadMembers(): Promise<void> {
    const companyId = this.companyService.activeCompany()?.id;
    if (!companyId) return;
    this.isLoading.set(true);
    try {
      // Subcolección por empresa: todos los docs pertenecen a este tenant.
      const snapshot = await getDocs(
        collection(this.firestore, 'companies', companyId, 'members')
      );
      this.members.set(
        snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            companyId: data['companyId'],
            userId: data['userId'],
            email: data['email'] ?? data['userId'],
            nombre: data['nombre'] ?? data['userId'],
            role: normalizeFirmRole(data['role'] ?? ''),
            departamento: data['departamento'] ?? '',
            estado: (data['estado'] ?? 'activo') as MemberEstado,
            ...(data['tarifaHoraria'] !== undefined ? { tarifaHoraria: data['tarifaHoraria'] } : {}),
            ...(data['permissionOverrides'] !== undefined
              ? { permissionOverrides: data['permissionOverrides'] }
              : {}),
            ...(data['customRoleId'] ? { customRoleId: data['customRoleId'] } : {}),
            ultimoLogin: data['ultimoLogin'] ?? null,
            createdAt: data['createdAt'],
          } as CompanyMember;
        })
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateMember(
    id: string,
    patch: Partial<
      Pick<
        CompanyMember,
        | 'role'
        | 'estado'
        | 'departamento'
        | 'tarifaHoraria'
        | 'nombre'
        | 'apellido'
        | 'telefono'
        | 'permissionOverrides'
        | 'customRoleId'
      >
    >
  ): Promise<void> {
    const companyId = this.companyService.activeCompany()?.id;
    if (!companyId) return;
    await updateDoc(doc(this.firestore, 'companies', companyId, 'members', id), stripUndefinedDeep({
      ...patch,
      updatedAt: serverTimestamp(),
    }));
    this.members.update(list => list.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }

  async removeMember(id: string): Promise<void> {
    const companyId = this.companyService.activeCompany()?.id;
    if (!companyId) return;
    await deleteDoc(doc(this.firestore, 'companies', companyId, 'members', id));
    this.members.update(list => list.filter(m => m.id !== id));
  }

  async recordLogin(uid: string, companyId: string): Promise<void> {
    // doc id == uid → acceso directo, sin query.
    const memberRef = doc(this.firestore, 'companies', companyId, 'members', uid);
    const snapshot = await getDoc(memberRef);
    if (!snapshot.exists()) return;
    await updateDoc(memberRef, stripUndefinedDeep({ ultimoLogin: serverTimestamp() }));
  }

  getRoles(): FirmRoleConfig[] {
    const counts = this.countByRole();
    return FIRM_ROLE_CONFIGS.map(r => ({ ...r, usuarios: counts[r.nombre] ?? 0 }));
  }
}
