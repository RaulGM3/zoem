import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointService } from '../../core/services/breakpoint.service';

/**
 * Detalle vacío de /configuracion. En escritorio hay lista y detalle a la vez,
 * así que se salta a la primera sección; en móvil se queda la lista sola.
 */
@Component({
  selector: 'app-configuracion-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class ConfiguracionIndexComponent {
  private readonly router = inject(Router);
  private readonly bp = inject(BreakpointService);

  constructor() {
    effect(() => {
      if (this.bp.isDesktop()) {
        void this.router.navigate(['/configuracion', 'empresa'], { replaceUrl: true });
      }
    });
  }
}
