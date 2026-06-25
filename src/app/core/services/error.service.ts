import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { addDoc, collection, Firestore, getDocs, limit, orderBy, query, serverTimestamp } from '@angular/fire/firestore';
import type { AppError, ErrorContext } from '../../interfaces/app-error.interface';
import { translateFirebaseError } from '../firebase/firebase-error';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { CompanyService } from './company.service';

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'function') return '[Function]';
      if (val instanceof Error) return { message: val.message, name: val.name };
      return val;
    });
  } catch {
    return '[unserializable]';
  }
}

@Injectable({ providedIn: 'root' })
export class ErrorService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);

  private get errorsCol() {
    return collection(this.firestore, 'app_errors');
  }

  async log(error: unknown, context?: ErrorContext): Promise<void> {
    try {
      const user = this.auth.currentUser;
      if (!user) return;

      const company = this.companyService.activeCompany();
      const info = translateFirebaseError(error);
      const err = error instanceof Error ? error : new Error(String(error));

      await addDoc(this.errorsCol, stripUndefinedDeep({
        userId: user.uid,
        userEmail: user.email ?? undefined,
        companyId: company?.id ?? undefined,
        companyName: company?.name ?? undefined,
        message: err.message,
        errorCode: info.code !== 'unknown' ? info.code : undefined,
        technicalDetail: info.technicalDetail,
        stack: err.stack ? err.stack.slice(0, 3000) : undefined,
        serviceName: context?.serviceName ?? undefined,
        methodName: context?.methodName ?? undefined,
        params: context?.params !== undefined
          ? safeStringify(context.params).slice(0, 2000)
          : undefined,
        url: typeof window !== 'undefined' ? window.location.pathname : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : undefined,
        createdAt: serverTimestamp(),
      }));
    } catch {
      // Nunca lanzar desde el error logger
    }
  }

  async loadErrors(): Promise<AppError[]> {
    const q = query(this.errorsCol, orderBy('createdAt', 'desc'), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppError);
  }
}
