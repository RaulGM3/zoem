import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';

/**
 * Las Storage rules autorizan con custom claims (companyId/role/estado), que
 * pueden estar viejos en el token o apuntar a otra empresa. Re-sincroniza los
 * claims para la empresa activa y, si cambiaron, fuerza un token nuevo para
 * que Storage los vea sin esperar el refresh horario.
 */
@Injectable({ providedIn: 'root' })
export class ClaimsSyncService {
  private readonly auth = inject(Auth);
  private readonly functions = inject(Functions);

  async sync(companyId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;
    try {
      const callable = httpsCallable<{ companyId: string }, { changed: boolean }>(this.functions, 'syncMyClaims');
      const { data } = await callable({ companyId });
      if (data.changed) await user.getIdToken(true);
    } catch (err) {
      console.error('[claims] error sincronizando claims:', err);
    }
  }
}
