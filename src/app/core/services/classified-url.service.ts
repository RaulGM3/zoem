import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { CompanyService } from './company.service';

interface ClassifiedUrlResponse {
  url: string;
  expiresInSeconds: number;
}

/**
 * URLs firmadas de corta vida para documentos CLASIFICADOS.
 * La Cloud Function valida la allowlist y escribe el evento de auditoría con
 * el Admin SDK — el rastro de vistas que ningún cliente puede falsificar.
 */
@Injectable({ providedIn: 'root' })
export class ClassifiedUrlService {
  private readonly functions = inject(Functions);
  private readonly companyService = inject(CompanyService);

  async getUrl(
    docPath: string,
    action: 'view' | 'download' = 'view',
    version?: number,
  ): Promise<string> {
    const companyId = this.companyService.activeCompany()?.id;
    if (!companyId) throw new Error('No active company');
    const callable = httpsCallable<
      { companyId: string; docPath: string; action: string; version?: number },
      ClassifiedUrlResponse
    >(this.functions, 'getClassifiedDocUrl');
    const result = await callable({ companyId, docPath, action, ...(version !== undefined ? { version } : {}) });
    return result.data.url;
  }
}
