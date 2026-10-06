import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { OverlayShellComponent } from '../../../../shared/components/overlay-shell/overlay-shell';
import { CuentasGestionComponent } from '../cuentas-gestion/cuentas-gestion';

@Component({
  selector: 'app-cuentas-drawer',
  imports: [OverlayShellComponent, CuentasGestionComponent],
  template: `
    <app-overlay-shell [open]="true" title="Cuentas bancarias" variant="drawer" size="md" (closed)="closed.emit()">
      <div class="px-4 py-5 sm:px-6">
        <app-cuentas-gestion />
      </div>
    </app-overlay-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuentasDrawerComponent {
  readonly closed = output<void>();
}
