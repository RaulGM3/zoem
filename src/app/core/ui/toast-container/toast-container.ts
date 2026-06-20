import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LucideAngularModule, CircleAlert, CircleCheck, Info, RotateCcw, X } from 'lucide-angular';
import { ToastService } from '../../services/toast.service';

/**
 * Pila de notificaciones fija arriba a la derecha. Renderiza los toasts del
 * [[toast-service]]. Los de error muestran "Reintentar" (si hay callback) y un
 * desplegable "Ver detalle" con el código técnico.
 */
@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div
      class="pointer-events-none fixed right-4 top-4 z-[1000] flex w-full max-w-sm flex-col gap-3"
      aria-live="assertive"
      aria-atomic="true"
    >
      @for (t of toast.toasts(); track t.id) {
        <div
          class="pointer-events-auto overflow-hidden rounded-xl border bg-white shadow-lg ring-1 ring-black/5"
          [class.border-red-200]="t.type === 'error'"
          [class.border-emerald-200]="t.type === 'success'"
          [class.border-slate-200]="t.type === 'info'"
          role="alert"
        >
          <div class="flex items-start gap-3 p-4">
            <span
              class="mt-0.5 shrink-0"
              [class.text-red-500]="t.type === 'error'"
              [class.text-emerald-500]="t.type === 'success'"
              [class.text-slate-400]="t.type === 'info'"
            >
              @switch (t.type) {
                @case ('error') { <lucide-icon [img]="AlertIcon" [size]="20" /> }
                @case ('success') { <lucide-icon [img]="CheckIcon" [size]="20" /> }
                @default { <lucide-icon [img]="InfoIcon" [size]="20" /> }
              }
            </span>

            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-slate-900">{{ t.title }}</p>
              <p class="mt-0.5 text-sm text-slate-600">{{ t.message }}</p>

              @if (t.retry || t.technicalDetail) {
                <div class="mt-2 flex items-center gap-3">
                  @if (t.retry) {
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                      (click)="onRetry(t.id, t.retry!)"
                    >
                      <lucide-icon [img]="RetryIcon" [size]="14" />
                      Reintentar
                    </button>
                  }
                  @if (t.technicalDetail) {
                    <button
                      type="button"
                      class="text-xs font-medium text-slate-400 hover:text-slate-600"
                      (click)="toggleDetail(t.id)"
                    >
                      {{ expandedId() === t.id ? 'Ocultar detalle' : 'Ver detalle' }}
                    </button>
                  }
                </div>
              }

              @if (t.technicalDetail && expandedId() === t.id) {
                <pre class="mt-2 max-h-32 overflow-auto rounded-md bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-500">{{ t.technicalDetail }}</pre>
              }
            </div>

            <button
              type="button"
              class="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cerrar notificación"
              (click)="toast.dismiss(t.id)"
            >
              <lucide-icon [img]="CloseIcon" [size]="16" />
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toast = inject(ToastService);
  readonly expandedId = signal<number | null>(null);

  readonly AlertIcon = CircleAlert;
  readonly CheckIcon = CircleCheck;
  readonly InfoIcon = Info;
  readonly RetryIcon = RotateCcw;
  readonly CloseIcon = X;

  onRetry(id: number, retry: () => void): void {
    this.toast.dismiss(id);
    retry();
  }

  toggleDetail(id: number): void {
    this.expandedId.update((cur) => (cur === id ? null : id));
  }
}
