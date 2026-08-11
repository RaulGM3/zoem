import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { CompanyService } from './company.service';
import { ErrorService } from './error.service';
import { PermissionService } from './permission.service';
import { UserSyncService } from './user-sync.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import type { Actividad } from '../../interfaces/actividad';
import type { Modulo } from '../permissions/permissions';

@Injectable({ providedIn: 'root' })
export class ActividadService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly errorService = inject(ErrorService);
  private readonly permissionService = inject(PermissionService);
  private readonly userSync = inject(UserSyncService);

  private actividadRef(companyId: string) {
    return collection(this.firestore, 'companies', companyId, 'actividad');
  }

  /**
   * Registra una acción en el feed de la empresa. Best-effort: nunca lanza,
   * para no romper la operación principal si el logging falla.
   */
  async log(modulo: Modulo, accion: string, entidadId?: string): Promise<void> {
    const companyId = this.companyService.activeCompany()?.id;
    if (!companyId) return;
    const member = this.permissionService.currentMember();
    const user = this.userSync.currentUser();
    const autorId = member?.userId ?? user?.id ?? '';
    const autorNombre = member?.nombre ?? user?.displayName ?? user?.email ?? 'Alguien';
    try {
      console.log('[Firebase][ActividadService.log] → addDoc companies/%s/actividad', companyId);
      await addDoc(this.actividadRef(companyId), stripUndefinedDeep({
        companyId,
        autorId,
        autorNombre,
        accion,
        modulo,
        ...(entidadId ? { entidadId } : {}),
        createdAt: serverTimestamp(),
      }));
      console.log('[Firebase][ActividadService.log] ✓ addDoc OK');
    } catch (err) {
      console.error('[Firebase][ActividadService.log] ✗ addDoc FAIL', err);
      void this.errorService.log(err, { serviceName: 'ActividadService', methodName: 'log' });
    }
  }

  /** Stream en tiempo real de las últimas acciones de la empresa. */
  recentStream(max = 20): Observable<Actividad[]> {
    const companyId = this.companyService.activeCompany()?.id;
    if (!companyId) return of([]);
    const q = query(this.actividadRef(companyId), orderBy('createdAt', 'desc'), limit(max));
    return collectionData(q, { idField: 'id' }) as Observable<Actividad[]>;
  }
}
