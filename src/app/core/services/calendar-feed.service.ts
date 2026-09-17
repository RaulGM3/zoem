import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

export interface CalendarFeedUrls {
  feedUrl: string;
  webcalUrl: string;
}

export interface CalendarFeedRevokeResult {
  revoked: number;
}

/**
 * Gestiona el token de suscripción al feed ICS del calendario (Fase 1).
 * El token en claro solo existe en la respuesta de `createToken` — el
 * backend únicamente persiste su hash. Ver functions/src/calendarFeed/tokens.ts.
 */
@Injectable({ providedIn: 'root' })
export class CalendarFeedService {
  private readonly functions = inject(Functions);

  async createToken(companyId: string): Promise<CalendarFeedUrls> {
    const fn = httpsCallable<{ companyId: string }, CalendarFeedUrls>(
      this.functions,
      'createCalendarFeedToken',
    );
    const result = await fn({ companyId });
    return result.data;
  }

  async revokeToken(companyId: string): Promise<CalendarFeedRevokeResult> {
    const fn = httpsCallable<{ companyId: string }, CalendarFeedRevokeResult>(
      this.functions,
      'revokeCalendarFeedToken',
    );
    const result = await fn({ companyId });
    return result.data;
  }
}
