import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { CompanyService, getLabelIdentificacion, type Company, type UbicacionEmpresa } from '../../../../core/services/company.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  cifValidatorPara,
  codigoPostalValidatorPara,
  normalizarDatosEmpresa,
  type DatosEmpresaForm,
} from '../../../../core/configuracion/datos-empresa';
import { monedaDeEmpresa, paisDeEmpresa, paisPorCodigo, type CodigoPais } from '../../../../core/paises/catalogo-paises';
import type { CiudadElegida } from '../../../../core/ubicacion/places.service';
import { CiudadComboboxComponent } from '../../../../shared/components/ciudad-combobox/ciudad-combobox';
import { zonaDeEmpresa } from '../../../../core/planes/periodo';
import { opcionesZona } from '../../../../core/planes/zonas';
import { ZONA_POR_DEFECTO } from '../../../../core/planes/periodo';
import { CompanyLogoUploaderComponent } from '../../../../shared/components/company-logo-uploader/company-logo-uploader';

@Component({
  selector: 'app-datos-empresa-seccion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CompanyLogoUploaderComponent, CiudadComboboxComponent],
  templateUrl: './datos-empresa-seccion.html',
})
export class DatosEmpresaSeccionComponent {
  private readonly companyService = inject(CompanyService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  /** País y moneda son fijos desde el alta: aquí solo se muestran (las rules impiden cambiarlos). */
  protected readonly pais = signal<CodigoPais>('ES');
  protected readonly moneda = signal('EUR');
  protected readonly paisActual = computed(() => paisPorCodigo(this.pais()));
  protected readonly ciudad = signal('');
  /** Ubicación guardada; se descarta en cuanto el texto de la ciudad deja de ser el elegido en Places. */
  private readonly ubicacion = signal<UbicacionEmpresa | null>(null);

  readonly form = this.fb.nonNullable.group({
    tipoPersona: ['juridica' as 'fisica' | 'juridica'],
    name: ['', Validators.required],
    cif: ['', cifValidatorPara(() => this.pais())],
    email: ['', Validators.email],
    telefono: [''],
    direccion: [''],
    codigoPostal: ['', codigoPostalValidatorPara(() => this.pais())],
    ciudad: [''],
    website: [''],
    zonaHoraria: [ZONA_POR_DEFECTO as string, Validators.required],
  });

  protected readonly guardando = signal(false);

  private readonly zonaActual = toSignal(
    this.form.controls.zonaHoraria.valueChanges.pipe(startWith(this.form.controls.zonaHoraria.value)),
    { requireSync: true },
  );
  protected readonly zonas = computed(() => opcionesZona(this.zonaActual()));

  private readonly tipoPersona = toSignal(
    this.form.controls.tipoPersona.valueChanges.pipe(startWith(this.form.controls.tipoPersona.value)),
    { requireSync: true },
  );
  private readonly estado = toSignal(this.form.statusChanges.pipe(startWith(this.form.status)), { requireSync: true });

  protected readonly nombreLabel = computed(() => (this.tipoPersona() === 'fisica' ? 'Nombre y apellidos' : 'Razón social'));
  /** España distingue NIF/CIF por tipo de persona; en el resto la etiqueta sale del catálogo (NIT, RUT, RFC). */
  protected readonly cifLabel = computed(() =>
    this.pais() === 'ES' ? getLabelIdentificacion({ tipoPersona: this.tipoPersona() } as Company) : this.paisActual().etiquetaIdFiscal,
  );
  protected readonly cifError = computed(() =>
    this.pais() === 'ES' ? 'Debe tener 9 caracteres alfanuméricos.' : `Revisa el formato del ${this.paisActual().etiquetaIdFiscal}.`,
  );
  protected readonly cpError = computed(() => `Debe tener ${this.paisActual().digitosCodigoPostal} dígitos.`);
  protected readonly puedeGuardar = computed(() => this.estado() === 'VALID' && !this.guardando());

  constructor() {
    effect(() => {
      const c = this.companyService.activeCompany();
      if (!c || this.form.dirty) return;
      // Antes del patch: los validators leen el país.
      this.pais.set(paisDeEmpresa(c));
      this.moneda.set(monedaDeEmpresa(c));
      this.ciudad.set(c.ciudad ?? '');
      this.ubicacion.set(c.ubicacion ?? null);
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
        zonaHoraria: zonaDeEmpresa(c),
      });
    });
  }

  protected alEscribirCiudad(texto: string): void {
    this.ciudad.set(texto);
    this.ubicacion.set(null);
    this.form.controls.ciudad.setValue(texto);
    this.form.controls.ciudad.markAsDirty();
  }

  protected alElegirCiudad(c: CiudadElegida): void {
    this.ciudad.set(c.nombre);
    this.ubicacion.set(c.lat !== undefined && c.lng !== undefined ? { placeId: c.placeId, lat: c.lat, lng: c.lng } : null);
    this.form.controls.ciudad.setValue(c.nombre);
    this.form.controls.ciudad.markAsDirty();
  }

  protected mostrarError(nombre: Exclude<keyof DatosEmpresaForm, 'ubicacion'>): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || c.dirty);
  }

  async guardar(): Promise<void> {
    const company = this.companyService.activeCompany();
    if (!company?.id || this.form.invalid || this.guardando()) return;
    this.guardando.set(true);
    try {
      await this.toast.run(
        () => this.companyService.updateCompany(company.id as string, normalizarDatosEmpresa({
          ...this.form.getRawValue(),
          // Con ubicación (nueva o guardada) se envía; si había una y ya no vale, se limpia; si nunca hubo, no se toca.
          ubicacion: this.ubicacion() ?? (company.ubicacion ? null : undefined),
        })),
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
