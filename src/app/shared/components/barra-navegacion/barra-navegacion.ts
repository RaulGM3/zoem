import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  type Event,
} from '@angular/router';
import { scan } from 'rxjs';

/** Estado "navegando" tras un evento del router; los eventos intermedios no lo cambian. */
export function navegandoTras(evento: Event, actual: boolean): boolean {
  if (evento instanceof NavigationStart) return true;
  if (evento instanceof NavigationEnd || evento instanceof NavigationCancel || evento instanceof NavigationError) {
    return false;
  }
  return actual;
}

/**
 * Barra fina arriba de la pantalla mientras el router navega (descarga del chunk + guards).
 * Aparece con 150 ms de retraso (CSS) para no parpadear en navegaciones instantáneas.
 */
@Component({
  selector: 'app-barra-navegacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (navegando()) {
      <div class="barra" role="progressbar" aria-label="Cargando página">
        <div class="relleno"></div>
      </div>
    }
  `,
  styles: `
    .barra {
      position: fixed; inset: 0 0 auto 0; z-index: 60; height: 3px; overflow: hidden;
      background: color-mix(in srgb, var(--brand) 15%, transparent);
      animation: barra-aparecer 1ms 150ms both;
    }
    .relleno {
      height: 100%; width: 40%; background: var(--brand);
      animation: barra-avance 1.1s ease-in-out infinite;
    }
    @keyframes barra-aparecer { from { visibility: hidden; } to { visibility: visible; } }
    @keyframes barra-avance { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
    @media (prefers-reduced-motion: reduce) {
      .relleno { width: 100%; animation: none; opacity: .6; }
    }
  `,
})
export class BarraNavegacionComponent {
  readonly navegando = toSignal(
    inject(Router).events.pipe(scan((actual, evento) => navegandoTras(evento, actual), false)),
    { initialValue: false },
  );
}
