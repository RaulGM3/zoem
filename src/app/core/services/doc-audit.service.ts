import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { ErrorService } from './error.service';
import { PermissionService } from './permission.service';
import { UserSyncService } from './user-sync.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import type { DocAuditAction, DocAuditEvent } from '../../interfaces/doc-lifecycle.interface';

/**
 * Auditoría por documento en la subcolección `doc_audit` del propio doc.
 * Append-only: las rules prohíben update/delete de eventos. Best-effort al
 * estilo de [[ActividadService]]: el log nunca rompe la operación principal.
 */
@Injectable({ providedIn: 'root' })
export class DocAuditService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly errorService = inject(ErrorService);
  private readonly permissionService = inject(PermissionService);
  private readonly userSync = inject(UserSyncService);

  private auditRef(parentPath: string) {
    return collection(this.firestore, parentPath, 'doc_audit');
  }

  /**
   * Registra una acción sobre el documento cuyo doc de Firestore vive en
   * `parentPath` (path completo, ej. `companies/c1/casos/k1/doc_files/f1`).
   */
  log(
    parentPath: string,
    action: DocAuditAction,
    opts: { version?: number; detail?: string } = {},
  ): void {
    const companyId = this.companyService.activeCompany()?.id;
    const user = this.userSync.currentUser();
    if (!companyId || !user) return;
    const member = this.permissionService.currentMember();
    void addDoc(
      this.auditRef(parentPath),
      stripUndefinedDeep({
        companyId,
        action,
        userId: user.id,
        userNombre: member?.nombre ?? user.displayName ?? user.email ?? 'Alguien',
        ...(opts.version !== undefined ? { version: opts.version } : {}),
        ...(opts.detail ? { detail: opts.detail } : {}),
        at: serverTimestamp(),
      }),
    ).catch(err => {
      void this.errorService.log(err, { serviceName: 'DocAuditService', methodName: 'log' });
    });
  }

  /** Historial completo del documento, más reciente primero. */
  async listEvents(parentPath: string): Promise<DocAuditEvent[]> {
    const q = query(this.auditRef(parentPath), orderBy('at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as DocAuditEvent);
  }
}
