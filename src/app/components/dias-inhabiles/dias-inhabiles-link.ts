import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, CalendarX } from 'lucide-angular';
import { PermissionService } from '../../core/services/permission.service';

/**
 * Enlace "Días inhábiles" para la cabecera del Calendario. Solo lo ven Admin y Gestor
 * (los que pueden editar los festivos; Configuración sigue siendo solo de Admin).
 */
@Component({
  selector: 'app-dias-inhabiles-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule],
  template: `
    @if (visible()) {
      <a routerLink="/calendario/dias-inhabiles"
        class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium max-sm:tap-target"
        style="background:var(--surface-2);color:var(--text-body)">
        <lucide-icon [img]="CalendarXIcon" class="size-4" aria-hidden="true"></lucide-icon>
        Días inhábiles
      </a>
    }
  `,
})
export class DiasInhabilesLinkComponent {
  private readonly permission = inject(PermissionService);
  protected readonly CalendarXIcon = CalendarX;
  protected readonly visible = computed(() => this.permission.hasRole('Admin', 'Gestor') || this.permission.isSuperUser());
}
