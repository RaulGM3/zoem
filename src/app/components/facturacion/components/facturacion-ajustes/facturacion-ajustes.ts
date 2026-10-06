import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { CompanyService, getLabelIdentificacion } from '../../../../core/services/company.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  FacturacionConfiguracionTabComponent,
  type ConfigFormGroup,
} from '../facturacion-configuracion-tab/facturacion-configuracion-tab';

/**
 * Ajustes de facturación (datos fiscales + Verifactu + credenciales AEAT).
 * Contenedor reutilizable: lo usan la pestaña "Configuración" de Facturación
 * y la sección Facturación de /configuracion.
 */
@Component({
  selector: 'app-facturacion-ajustes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FacturacionConfiguracionTabComponent],
  template: `
    <app-facturacion-configuracion-tab
      [form]="configForm"
      [saving]="savingConfig()"
      [cifLabel]="cifLabel()"
      (save)="saveConfig()"
    />
  `,
})
export class FacturacionAjustesComponent {
  private readonly companyService = inject(CompanyService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly savingConfig = signal(false);

  readonly cifLabel = computed(() => {
    const c = this.companyService.activeCompany();
    return c ? getLabelIdentificacion(c) : 'CIF / NIF';
  });

  readonly configForm: ConfigFormGroup = this.fb.nonNullable.group({
    name: ['', Validators.required],
    cif: [''],
    tipoPersona: ['juridica' as 'fisica' | 'juridica'],
    verifactuEnabled: [false],
    verifactuSandbox: [false],
  });

  constructor() {
    effect(() => {
      const c = this.companyService.activeCompany();
      if (c) {
        this.configForm.patchValue({
          name: c.name,
          cif: c.cif ?? '',
          tipoPersona: c.tipoPersona ?? 'juridica',
          verifactuEnabled: c.verifactu?.enabled ?? false,
          verifactuSandbox: c.verifactu?.sandbox ?? false,
        }, { emitEvent: false });
      }
    });
  }

  async saveConfig(): Promise<void> {
    const company = this.companyService.activeCompany();
    if (!company?.id || this.savingConfig()) return;
    const { name, cif, tipoPersona, verifactuEnabled, verifactuSandbox } = this.configForm.getRawValue();
    this.savingConfig.set(true);
    try {
      await this.toast.run(
        () => this.companyService.updateCompany(company.id, {
          name: name.trim(),
          cif: cif.trim() || undefined,
          tipoPersona,
          verifactu: { ...company.verifactu, enabled: verifactuEnabled, sandbox: verifactuSandbox },
        }),
        { successMessage: 'Configuración guardada', errorTitle: 'No se pudo guardar la configuración' }
      );
    } finally {
      this.savingConfig.set(false);
    }
  }
}
