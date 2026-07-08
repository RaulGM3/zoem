import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NoPermissionComponent } from '../../shared/components/no-permission/no-permission';
import { MODULOS, type Modulo } from '../../core/permissions/permissions';

/**
 * Página de destino cuando el guard deniega un módulo: explica amablemente
 * la situación y permite solicitar el permiso al admin desde ahí mismo.
 */
@Component({
  selector: 'app-sin-acceso',
  imports: [NoPermissionComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-lg p-6 space-y-4">
      @if (modulo(); as m) {
        <app-no-permission [modulo]="m" capability="ver" />
      } @else {
        <p class="text-sm text-slate-600 text-center py-10">Esta sección no existe.</p>
      }
      <p class="text-center">
        <a routerLink="/" class="text-sm text-violet-600 font-medium hover:underline">Volver al inicio</a>
      </p>
    </div>
  `,
})
export class SinAccesoComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly moduloParam = toSignal(
    this.route.paramMap.pipe(map(params => params.get('modulo'))),
    { initialValue: null },
  );

  readonly modulo = computed<Modulo | null>(() => {
    const raw = this.moduloParam();
    return MODULOS.includes(raw as Modulo) ? (raw as Modulo) : null;
  });
}
