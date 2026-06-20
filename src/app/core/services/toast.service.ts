import { Injectable, signal } from '@angular/core';
import { translateFirebaseError } from '../firebase/firebase-error';

export type ToastType = 'error' | 'success' | 'info';

export interface Toast {
  readonly id: number;
  readonly type: ToastType;
  readonly title: string;
  readonly message: string;
  /** Acción de reintento. Si existe, el toast muestra el botón "Reintentar". */
  readonly retry?: () => void;
  /** Detalle técnico (code + mensaje original) para el bloque "Ver detalle". */
  readonly technicalDetail?: string;
}

interface ErrorToastOptions {
  /** Título a mostrar (por defecto "No se pudo completar la acción"). */
  title?: string;
  /** Callback de reintento. Habilita el botón "Reintentar". */
  retry?: () => void;
}

interface RunOptions {
  /** Mensaje de éxito (toast verde) si la acción termina bien. */
  successMessage?: string;
  /** Título del toast de error. */
  errorTitle?: string;
  /**
   * Se ejecuta SOLO cuando la acción termina bien (incluido tras un reintento
   * exitoso). Útil para cerrar drawers/modales únicamente si la escritura pasó.
   */
  onSuccess?: () => void;
}

const AUTO_DISMISS_MS = 5000;

/**
 * Notificaciones centralizadas con soporte de reintento.
 *
 * Filosofía: NINGÚN error de Firebase debe romper la app en silencio. Todo
 * error se traduce a un mensaje humano (vía [[firebase-error]]) y SIEMPRE se
 * ofrece reintentar la operación que falló.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 0;

  success(message: string, title = 'Hecho'): void {
    this.push({ type: 'success', title, message });
  }

  info(message: string, title = 'Información'): void {
    this.push({ type: 'info', title, message });
  }

  /**
   * Muestra un error de Firebase ya traducido. Loguea el detalle técnico a la
   * consola para debug y, si se pasa `retry`, ofrece el botón de reintento.
   */
  fromError(err: unknown, opts: ErrorToastOptions = {}): void {
    const info = translateFirebaseError(err);
    // El detalle técnico SIEMPRE va a consola — el usuario ve el mensaje humano.
    console.error('[Firebase]', info.technicalDetail, err);
    this.push({
      type: 'error',
      title: opts.title ?? 'No se pudo completar la acción',
      message: info.message,
      retry: opts.retry,
      technicalDetail: info.technicalDetail,
    });
  }

  /**
   * Envuelve una acción async: si todo va bien (y hay `successMessage`) muestra
   * un toast verde; si falla, muestra el error con un botón "Reintentar" que
   * re-ejecuta la MISMA acción. Devuelve el resultado o `undefined` si falló.
   *
   * Así un componente reduce todo su manejo de errores a:
   *   await this.toast.run(() => this.svc.createX(data), { successMessage: '...' });
   */
  async run<T>(action: () => Promise<T>, opts: RunOptions = {}): Promise<T | undefined> {
    try {
      const result = await action();
      if (opts.successMessage) this.success(opts.successMessage);
      opts.onSuccess?.();
      return result;
    } catch (err) {
      this.fromError(err, {
        title: opts.errorTitle,
        retry: () => void this.run(action, opts),
      });
      return undefined;
    }
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear(): void {
    this.toasts.set([]);
  }

  private push(toast: Omit<Toast, 'id'>): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { ...toast, id }]);
    // Éxito/info se auto-cierran; los errores permanecen para poder reintentar.
    if (toast.type !== 'error') {
      setTimeout(() => this.dismiss(id), AUTO_DISMISS_MS);
    }
  }
}
