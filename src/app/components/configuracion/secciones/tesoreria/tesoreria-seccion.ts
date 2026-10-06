import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CuentasService } from '../../../../core/services/cuentas.service';
import { CuentasGestionComponent } from '../../../tesoreria/components/cuentas-gestion/cuentas-gestion';

/**
 * Host de CuentasGestion: es dueño del ciclo de vida del listener de cuentas
 * (CuentasService tiene un único listener compartido con Tesorería).
 */
@Component({
  selector: 'app-tesoreria-seccion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CuentasGestionComponent],
  template: `
    <div class="space-y-4">
      <header>
        <h2 id="config-detalle-titulo" tabindex="-1" class="text-xl font-semibold outline-none" style="color:var(--text-strong)">Tesorería</h2>
        <p class="mt-1 text-sm" style="color:var(--text-muted)">Cuentas bancarias y cajas del despacho.</p>
      </header>
      <section aria-label="Cuentas bancarias y cajas" class="rounded-xl p-5" style="border:1px solid var(--border);background:var(--surface)">
        <app-cuentas-gestion />
      </section>
    </div>
  `,
})
export class TesoreriaSeccionComponent implements OnInit {
  private readonly cuentasService = inject(CuentasService);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cuentasService.stopCuentas());
  }

  ngOnInit(): void {
    this.cuentasService.loadCuentas();
  }
}
