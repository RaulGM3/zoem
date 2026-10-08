import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { CircleHelp, LucideAngularModule } from 'lucide-angular';
import { filter, map } from 'rxjs';
import { CARGADOR_GUIAS } from '../../../core/ayuda/cargador-guias.token';
import { guiasVisibles } from '../../../core/ayuda/filtro-guias';
import type { Guia } from '../../../core/ayuda/guia';
import { guiaDeRuta } from '../../../core/ayuda/guia-de-ruta';
import { PermissionService } from '../../../core/services/permission.service';
import { AyudaModalComponent } from './ayuda-modal';

/**
 * Botón de ayuda del toolbar. Contenedor: decide qué guía corresponde a la
 * pantalla actual (por ruta y por permisos) y se la pasa al modal, que solo la pinta.
 * Las guías se cargan al abrir por primera vez: el contenido vive en un chunk diferido.
 */
@Component({
  selector: 'app-ayuda-contextual',
  imports: [LucideAngularModule, AyudaModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!enAyuda()) {
      <button type="button" aria-label="Ayuda de esta pantalla" title="Ayuda de esta pantalla"
        aria-haspopup="dialog" (click)="abrir()"
        class="tap-target inline-flex items-center justify-center rounded-xl p-2 transition-colors duration-150 hover:bg-[var(--surface-2)]"
        style="color:var(--text-muted)">
        <lucide-icon [img]="HelpIcon" size="20" aria-hidden="true" />
      </button>
    }
    @if (abierto()) {
      <app-ayuda-modal [open]="true" [guia]="guia() ?? null" [cargando]="cargando()" [error]="error()"
        (closed)="abierto.set(false)" (reintentar)="cargar()" />
    }
  `,
})
export class AyudaContextualComponent {
  private readonly router = inject(Router);
  private readonly perm = inject(PermissionService);
  private readonly cargador = inject(CARGADOR_GUIAS);

  protected readonly HelpIcon = CircleHelp;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly guias = signal<readonly Guia[] | null>(null);
  protected readonly abierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal(false);

  /** En la página de ayuda el botón sobra: ya estás leyendo las guías. */
  protected readonly enAyuda = computed(() => /^\/ayuda(\/|$|\?|#)/.test(this.url()));

  /** Guía de la pantalla actual entre las que este usuario puede ver. */
  protected readonly guia = computed(() => {
    const guias = this.guias();
    if (!guias) return undefined;
    const visibles = guiasVisibles(guias, (modulo, capacidad) => this.perm.can(modulo, capacidad));
    return guiaDeRuta(visibles, this.url());
  });

  protected abrir(): void {
    this.abierto.set(true);
    if (!this.guias() && !this.cargando()) this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      this.guias.set(await this.cargador());
    } catch {
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }
}
