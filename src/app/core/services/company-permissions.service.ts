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
import type { MatrixOverride } from '../permissions/permissions';
import type { CompanyPermissions } from '../../interfaces/company-permissions.interface';

/**
 * Matriz de permisos configurada por la empresa (deltas sobre la base).
 * Se auto-suscribe a la empresa activa: `PermissionService.can()` la lee en
 * cada evaluación, así que tiene que estar viva sin que nadie llame a load().
 */
@Injectable({ providedIn: 'root' })
export class CompanyPermissionsService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly userSync = inject(UserSyncService);

  /** null = doc inexistente o sin cargar → aplica la matriz base. */
  readonly companyMatrix = signal<MatrixOverride | null>(null);

  private unsub: Unsubscribe | null = null;

  constructor() {
    effect(() => {
      const companyId = this.companyService.activeCompany()?.id;
      this.unsub?.();
      this.unsub = null;
      this.companyMatrix.set(null);
      if (!companyId) return;
      this.unsub = onSnapshot(this.permissionsRef(companyId), snap => {
        const data = snap.data() as CompanyPermissions | undefined;
        this.companyMatrix.set(data?.matrix ?? null);
      });
    });
  }

  private permissionsRef(companyId: string) {
    return doc(this.firestore, 'companies', companyId, 'settings', 'permissions');
  }

  async saveMatrix(matrix: MatrixOverride): Promise<void> {
    const companyId = this.companyService.activeCompany()?.id;
    if (!companyId) throw new Error('No active company');
    await setDoc(
      this.permissionsRef(companyId),
      stripUndefinedDeep({
        matrix,
        updatedAt: serverTimestamp(),
        updatedBy: this.userSync.currentUser()?.id ?? '',
      }),
    );
  }

  async resetDefaults(): Promise<void> {
    await this.saveMatrix({});
  }
}
