import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LogOut, LucideAngularModule, ShieldAlert } from 'lucide-angular';
import { CompanyService } from '../../../core/services/company.service';

/** Aviso persistente mientras el superusuario opera una empresa de la que no es miembro. */
@Component({
  selector: 'app-aviso-modo-superuser',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (company.modoSuperuser()) {
      <div
        role="status"
        class="flex items-center gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950 lg:px-6 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100"
      >
        <lucide-icon [img]="ShieldAlertIcon" [size]="16" aria-hidden="true" class="shrink-0" />
        <p class="min-w-0 flex-1 truncate">
          Estás dentro de <strong>{{ company.activeCompany()?.name }}</strong> como superusuario.
          Los cambios afectan a esta empresa.
        </p>
        <button
          type="button"
          (click)="company.salirModoSuperuser()"
          class="tap-target inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition-colors hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:hover:bg-amber-500/25"
        >
          <lucide-icon [img]="LogOutIcon" [size]="14" aria-hidden="true" />
          Salir
        </button>
      </div>
    }
  `,
})
export class AvisoModoSuperuserComponent {
  protected readonly ShieldAlertIcon = ShieldAlert;
  protected readonly LogOutIcon = LogOut;
  protected readonly company = inject(CompanyService);
}
