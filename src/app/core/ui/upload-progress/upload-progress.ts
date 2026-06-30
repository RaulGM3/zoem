import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UploadQueueService } from '../../services/upload-queue.service';

@Component({
  selector: 'app-upload-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (queue.hasPending()) {
      <div
        class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-lg"
        role="status"
        aria-live="polite"
        aria-label="Subida en progreso"
      >
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-violet-500"></span>
        Subiendo {{ queue.pendingCount() }} archivo{{ queue.pendingCount() === 1 ? '' : 's' }}…
      </div>
    }
  `,
})
export class UploadProgressComponent {
  readonly queue = inject(UploadQueueService);
}
