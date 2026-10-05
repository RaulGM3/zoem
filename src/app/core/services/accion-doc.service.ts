import { inject, Injectable } from '@angular/core';
import { Storage, ref, uploadBytes } from '@angular/fire/storage';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { CompanyService } from './company.service';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Sube el .docx generado por una acción a `companies/{cid}/acciones_envios/`
 * y pide al callable `accionDocUrl` una URL firmada de lectura que pueda abrir
 * el destinatario (válida 7 días: máximo de una URL firmada V4).
 */
@Injectable({ providedIn: 'root' })
export class AccionDocService {
  private readonly storage = inject(Storage);
  private readonly functions = inject(Functions);
  private readonly companyService = inject(CompanyService);

  async subirYFirmar(registroId: string, docx: Blob): Promise<{ path: string; url: string }> {
    const companyId = this.companyService.activeCompany()?.id;
    if (!companyId) throw new Error('No active company');
    const path = `companies/${companyId}/acciones_envios/${registroId}.docx`;
    await uploadBytes(ref(this.storage, path), docx, { contentType: DOCX_MIME });
    const firmar = httpsCallable<{ companyId: string; path: string }, { url: string; expiresInDays: number }>(
      this.functions,
      'accionDocUrl',
    );
    const res = await firmar({ companyId, path });
    return { path, url: res.data.url };
  }
}
