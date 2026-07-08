import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PermissionRequestService } from '../../../core/services/permission-request.service';
import { ToastService } from '../../../core/services/toast.service';
import type { Capability, Modulo } from '../../../core/permissions/permissions';

/**
 * Estado vacío amable para "no tienes permiso", con CTA para pedírselo al admin.
 * Uso: `<app-no-permission [modulo]="'Casos'" [capability]="'crear'" />`
 */
@Component({
  selector: 'app-no-permission',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-800/50">
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true">
        <svg class="h-6 w-6 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </div>
      <p class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ mensaje() }}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        Si lo necesitas para tu trabajo, pídeselo a tu administrador desde aquí.
      </p>
      @if (pendiente()) {
        <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          Solicitud pendiente de aprobación
        </span>
      } @else {
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
          [disabled]="enviando()"
          (click)="solicitar()"
        >
          Solicitar permiso al administrador
        </button>
      }
    </div>
  `,
})
export class NoPermissionComponent {
  private readonly requestService = inject(PermissionRequestService);
  private readonly toast = inject(ToastService);

  readonly modulo = input.required<Modulo>();
  readonly capability = input<Capability>('ver');
  /** Mensaje opcional; si no se pasa, se construye uno genérico. */
  readonly customMessage = input<string | null>(null);

  readonly enviando = signal(false);

  readonly mensaje = computed(
    () => this.customMessage() ?? `No tienes permiso para acceder a ${this.modulo()}.`,
  );

  readonly pendiente = computed(() => {
    // Lee el signal de solicitudes → se actualiza en vivo al crear una.
    void this.requestService.misSolicitudes();
    return this.requestService.hasPending(this.modulo(), this.capability());
  });

  async solicitar(): Promise<void> {
    this.enviando.set(true);
    try {
      await this.requestService.request(this.modulo(), this.capability());
      this.toast.success('Tu administrador recibirá la solicitud.', 'Solicitud enviada');
    } catch (err) {
      this.toast.fromError(err, { retry: () => this.solicitar() });
    } finally {
      this.enviando.set(false);
    }
  }
}
