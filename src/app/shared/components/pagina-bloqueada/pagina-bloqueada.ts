import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule, Lock, Check } from 'lucide-angular';

/**
 * Vista previa de una función que el plan no incluye. Presentacional: recibe los
 * textos ya resueltos y emite `mejorar`; no conoce planes ni rutas.
 */
@Component({
  selector: 'app-pagina-bloqueada',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto flex max-w-xl flex-col items-center gap-5 px-6 py-12 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl"
        style="background:color-mix(in srgb,var(--brand) 12%,var(--surface-2));color:var(--brand)" aria-hidden="true">
        <lucide-icon [img]="LockIcon" size="26" />
      </div>
      <div class="space-y-2">
        <h1 class="text-xl font-semibold" style="color:var(--text-strong);font-family:var(--font-display)">{{ titulo() }}</h1>
        <p class="text-sm" style="color:var(--text-body)">{{ descripcion() }}</p>
      </div>
      <ul class="w-full space-y-2 rounded-2xl p-4 text-left text-sm"
        style="background:var(--surface-2);color:var(--text-body)">
        @for (b of beneficios(); track b) {
          <li class="flex items-start gap-2">
            <lucide-icon [img]="CheckIcon" size="16" class="mt-0.5 shrink-0" style="color:var(--brand)" aria-hidden="true" />
            <span>{{ b }}</span>
          </li>
        }
      </ul>
      <p class="text-xs" style="color:var(--text-muted)">Esta función no está incluida en tu plan actual.</p>
      <button type="button" (click)="mejorar.emit()"
        class="tap-target min-h-11 rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2">
        Mejorar plan
      </button>
    </section>
  `,
})
export class PaginaBloqueadaComponent {
  protected readonly LockIcon = Lock;
  protected readonly CheckIcon = Check;

  readonly titulo = input.required<string>();
  readonly descripcion = input.required<string>();
  readonly beneficios = input.required<readonly string[]>();
  readonly mejorar = output<void>();
}
