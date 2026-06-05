import { computed, inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
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
      const q = query(
        collection(this.firestore, 'companyMembers'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(q);
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
    patch: Partial<Pick<CompanyMember, 'role' | 'estado' | 'departamento'>>
  ): Promise<void> {
    await updateDoc(doc(this.firestore, 'companyMembers', id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    this.members.update(list => list.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }

  async removeMember(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'companyMembers', id));
    this.members.update(list => list.filter(m => m.id !== id));
  }

  async recordLogin(email: string, companyId: string): Promise<void> {
    const q = query(
      collection(this.firestore, 'companyMembers'),
      where('companyId', '==', companyId),
      where('userId', '==', email)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;
    await updateDoc(snapshot.docs[0].ref, { ultimoLogin: serverTimestamp() });
  }

  getRoles(): FirmRoleConfig[] {
    const counts = this.countByRole();
    return FIRM_ROLE_CONFIGS.map(r => ({ ...r, usuarios: counts[r.nombre] ?? 0 }));
  }
}
