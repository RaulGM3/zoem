import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, ChevronLeft } from 'lucide-angular';
import { DiasInhabilesSeccionComponent } from './dias-inhabiles-seccion';

/**
 * Página independiente de "Días inhábiles" en /calendario/dias-inhabiles (Admin y Gestor).
 * Reutiliza la misma sección que Configuración (solo Admin), sin abrir el resto de Configuración.
 */
@Component({
  selector: 'app-dias-inhabiles-pagina',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, DiasInhabilesSeccionComponent],
  template: `
    <div class="mx-auto max-w-4xl space-y-4">
      <h1 class="sr-only">Días inhábiles del calendario judicial</h1>
      <a routerLink="/calendario" class="inline-flex items-center gap-1 text-sm font-medium max-sm:tap-target" style="color:var(--brand)">
        <lucide-icon [img]="ChevronLeftIcon" class="size-4" aria-hidden="true"></lucide-icon>
        Volver al calendario
      </a>
      <app-dias-inhabiles-seccion />
    </div>
  `,
})
export class DiasInhabilesPaginaComponent {
  protected readonly ChevronLeftIcon = ChevronLeft;
}
