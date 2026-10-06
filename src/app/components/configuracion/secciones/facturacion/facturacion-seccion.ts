import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FacturacionAjustesComponent } from '../../../facturacion/components/facturacion-ajustes/facturacion-ajustes';

@Component({
  selector: 'app-facturacion-seccion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FacturacionAjustesComponent],
  template: `
    <div class="space-y-4">
      <header>
        <h2 id="config-detalle-titulo" tabindex="-1" class="text-xl font-semibold outline-none" style="color:var(--text-strong)">Facturación</h2>
        <p class="mt-1 text-sm" style="color:var(--text-muted)">Datos fiscales, Verifactu y credenciales de la AEAT.</p>
      </header>
      <app-facturacion-ajustes />
    </div>
  `,
})
export class FacturacionSeccionComponent {}
