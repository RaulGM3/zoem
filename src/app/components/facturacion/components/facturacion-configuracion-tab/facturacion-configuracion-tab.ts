import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { LucideAngularModule, Building2, ShieldCheck, Save } from 'lucide-angular';
import { CredencialesAeatComponent } from '../../../credenciales-aeat/credenciales-aeat';

export type ConfigFormGroup = FormGroup<{
  name: FormControl<string>;
  cif: FormControl<string>;
  tipoPersona: FormControl<'fisica' | 'juridica'>;
  verifactuEnabled: FormControl<boolean>;
  verifactuSandbox: FormControl<boolean>;
}>;

@Component({
  selector: 'app-facturacion-configuracion-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LucideAngularModule, CredencialesAeatComponent],
  templateUrl: './facturacion-configuracion-tab.html',
})
export class FacturacionConfiguracionTabComponent {
  readonly form = input.required<ConfigFormGroup>();
  readonly saving = input.required<boolean>();
  readonly cifLabel = input.required<string>();

  readonly save = output<void>();

  readonly Building2Icon = Building2;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly SaveIcon = Save;
}
