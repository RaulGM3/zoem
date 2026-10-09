import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CompanyService } from '../../../core/services/company.service';

/**
 * Cambia entre los despachos del usuario (p. ej. el real y el de ejemplo).
 * Solo aparece con más de uno. Cambiar recarga la app (ver CompanyService.cambiarEmpresa).
 */
@Component({
  selector: 'app-selector-empresa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <select
        aria-label="Despacho activo"
        (change)="elegir($any($event.target).value)"
        class="tap-target max-w-48 truncate rounded-lg border px-2 py-1.5 text-sm"
        style="border-color:var(--border);background:var(--surface-1, transparent);color:var(--text-strong)"
      >
        @for (o of opciones(); track o.id) {
          <option [value]="o.id" [selected]="o.id === activaId()">{{ o.nombre }}</option>
        }
      </select>
    }
  `,
})
export class SelectorEmpresaComponent {
  private readonly company = inject(CompanyService);

  protected readonly opciones = computed(() =>
    this.company.myMemberships().map((m) => ({ id: m.companyId, nombre: m.company?.name ?? m.companyId })),
  );
  protected readonly activaId = computed(() => this.company.activeCompany()?.id);
  protected readonly visible = computed(() => this.opciones().length > 1 && !this.company.modoSuperuser());

  protected elegir(id: string): void {
    if (id && id !== this.activaId()) this.company.cambiarEmpresa(id);
  }
}
