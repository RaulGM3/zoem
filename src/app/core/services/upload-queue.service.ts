import { computed, inject, Injectable, signal } from '@angular/core';
import { ToastService } from './toast.service';

interface QueueEntry {
  readonly id: string;
  readonly name: string;
}

export interface UploadEnqueueOptions {
  successMessage?: string;
  errorTitle?: string;
  onFinally?: () => void;
}

@Injectable({ providedIn: 'root' })
export class UploadQueueService {
  private readonly toast = inject(ToastService);
  private readonly _pending = signal<QueueEntry[]>([]);

  readonly pendingCount = computed(() => this._pending().length);
  readonly hasPending = computed(() => this._pending().length > 0);

  enqueue(action: () => Promise<void>, fileName: string, opts: UploadEnqueueOptions = {}): void {
    const id = crypto.randomUUID();
    this._pending.update(list => [...list, { id, name: fileName }]);

    void this.toast.run(action, {
      successMessage: opts.successMessage,
      errorTitle: opts.errorTitle,
    }).finally(() => {
      this._pending.update(list => list.filter(e => e.id !== id));
      opts.onFinally?.();
    });
  }
}
