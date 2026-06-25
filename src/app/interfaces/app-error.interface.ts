import { Timestamp } from '@angular/fire/firestore';

export interface AppError {
  id: string;
  userId: string;
  userEmail?: string;
  companyId?: string;
  companyName?: string;
  message: string;
  errorCode?: string;
  technicalDetail?: string;
  stack?: string;
  serviceName?: string;
  methodName?: string;
  params?: string;
  url?: string;
  userAgent?: string;
  createdAt: Timestamp;
}

export interface ErrorContext {
  serviceName?: string;
  methodName?: string;
  params?: unknown;
}
