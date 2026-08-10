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
  /**
   * `true` cuando el error fue "esperado" por el llamador (p.ej. un
   * `permission-denied` tratado como caso normal de negocio: soft delete o
   * visibilidad restringida) en vez de un fallo real. Campo TOP-LEVEL propio
   * (no metido dentro de `params`) para que sea un flag consultable/filtrable
   * de verdad — antes viajaba dentro de `params` y quedaba opaco tras
   * `safeStringify`.
   */
  expected?: boolean;
  createdAt: Timestamp;
}

export interface ErrorContext {
  serviceName?: string;
  methodName?: string;
  params?: unknown;
  /** Ver `AppError.expected`. Se guarda como campo propio, nunca dentro de `params`. */
  expected?: boolean;
}
