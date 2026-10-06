import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, inject,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule, ChevronLeft, ChevronRight } from 'lucide-angular';
import { filter, map } from 'rxjs';
import { SECCIONES_CONFIG, seccionDesdeUrl } from '../../core/configuracion/secciones';

/**
 * Shell maestro-detalle de Configuración: lista de secciones (izquierda) y
 * detalle (derecha). En móvil se ve una u otra según haya sección activa.
 */
@Component({
  selector: 'app-configuracion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './configuracion.html',
})
export class ConfiguracionComponent {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly secciones = SECCIONES_CONFIG;
  readonly ChevronRightIcon = ChevronRight;
  readonly ChevronLeftIcon = ChevronLeft;

  readonly seccionActiva = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => seccionDesdeUrl(e.urlAfterRedirects)),
    ),
    { initialValue: seccionDesdeUrl(this.router.url) },
  );

  constructor() {
    // Foco: tras cada navegación interna, al h2 del detalle (o al h1 al volver a la lista).
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((e) => {
        const seccion = seccionDesdeUrl(e.urlAfterRedirects);
        afterNextRender(() => {
          const destino = this.host.nativeElement.querySelector<HTMLElement>(
            seccion ? '#config-detalle-titulo' : '#config-titulo',
          );
          destino?.focus({ preventScroll: false });
        }, { injector: this.injector });
      });
  }
}
