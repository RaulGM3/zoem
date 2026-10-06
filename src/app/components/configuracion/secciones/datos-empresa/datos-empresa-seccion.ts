import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { CompanyService, getLabelIdentificacion, type Company } from '../../../../core/services/company.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  cifValidator,
  codigoPostalValidator,
  normalizarDatosEmpresa,
  type DatosEmpresaForm,
} from '../../../../core/configuracion/datos-empresa';
import { CompanyLogoUploaderComponent } from '../../../../shared/components/company-logo-uploader/company-logo-uploader';

@Component({
  selector: 'app-datos-empresa-seccion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CompanyLogoUploaderComponent],
  templateUrl: './datos-empresa-seccion.html',
})
export class DatosEmpresaSeccionComponent {
  private readonly companyService = inject(CompanyService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    tipoPersona: ['juridica' as 'fisica' | 'juridica'],
    name: ['', Validators.required],
    cif: ['', cifValidator],
    email: ['', Validators.email],
    telefono: [''],
    direccion: [''],
    codigoPostal: ['', codigoPostalValidator],
    ciudad: [''],
    website: [''],
  });

  protected readonly guardando = signal(false);

  private readonly tipoPersona = toSignal(
    this.form.controls.tipoPersona.valueChanges.pipe(startWith(this.form.controls.tipoPersona.value)),
    { requireSync: true },
  );
  private readonly estado = toSignal(this.form.statusChanges.pipe(startWith(this.form.status)), { requireSync: true });

  protected readonly nombreLabel = computed(() => (this.tipoPersona() === 'fisica' ? 'Nombre y apellidos' : 'Razón social'));
  protected readonly cifLabel = computed(() => getLabelIdentificacion({ tipoPersona: this.tipoPersona() } as Company));
  protected readonly puedeGuardar = computed(() => this.estado() === 'VALID' && !this.guardando());

  constructor() {
    effect(() => {
      const c = this.companyService.activeCompany();
      if (!c || this.form.dirty) return;
      this.form.patchValue({
        tipoPersona: c.tipoPersona ?? 'juridica',
        name: c.name ?? '',
        cif: c.cif ?? '',
        email: c.email ?? '',
        telefono: c.telefono ?? '',
        direccion: c.direccion ?? '',
        codigoPostal: c.codigoPostal ?? '',
        ciudad: c.ciudad ?? '',
        website: c.website ?? '',
      });
    });
  }

  protected mostrarError(nombre: keyof DatosEmpresaForm): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || c.dirty);
  }

  async guardar(): Promise<void> {
    const company = this.companyService.activeCompany();
    if (!company?.id || this.form.invalid || this.guardando()) return;
    this.guardando.set(true);
    try {
      await this.toast.run(
        () => this.companyService.updateCompany(company.id as string, normalizarDatosEmpresa(this.form.getRawValue())),
        {
          successMessage: 'Datos de la empresa guardados',
          errorTitle: 'No se pudieron guardar los datos',
          onSuccess: () => this.form.markAsPristine(),
        },
      );
    } finally {
      this.guardando.set(false);
    }
  }
}
