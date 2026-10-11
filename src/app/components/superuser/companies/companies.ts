import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  Building2,
  Check,
  LogIn,
  LucideAngularModule,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-angular';
import { deleteField } from '@angular/fire/firestore';
import { Company, RUBRO_LABELS, TipoPersona } from '../../../interfaces/company';
import { PAISES, paisDeEmpresa, monedaDeEmpresa, paisPorCodigo, regionDeEmpresa, type CodigoPais } from '../../../core/paises/catalogo-paises';
import { geoParaGuardar, nombreRegion, verifactuDisponible } from '../../../core/paises/geo-empresa';
import { SuperuserService } from '../../../services/superuser';
import { ToastService } from '../../../core/services/toast.service';
import { CompanyService } from '../../../core/services/company.service';
import { COMPLEMENTOS, type ComplementoId } from '../../../core/planes/catalogo';
import { etiquetasEmpresa } from '../../../core/planes/etiquetas-empresa';
import { formDesdeSuscripcion, suscripcionDesdeForm } from '../../../core/planes/suscripcion-form';

@Component({
  selector: 'app-companies',
  imports: [ReactiveFormsModule, LucideAngularModule],
  templateUrl: './companies.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompaniesComponent {
  readonly Building2Icon = Building2;
  readonly SearchIcon = Search;
  readonly PlusIcon = Plus;
  readonly EditIcon = Pencil;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;
  readonly CheckIcon = Check;
  readonly LogInIcon = LogIn;

  readonly rubroLabels = RUBRO_LABELS;
  readonly paises = PAISES;
  readonly nombreRegion = nombreRegion;
  readonly paisDeEmpresa = paisDeEmpresa;

  private fb = inject(FormBuilder);
  private svc = inject(SuperuserService);
  private readonly toast = inject(ToastService);
  private readonly companyService = inject(CompanyService);

  companies = toSignal(this.svc.getCompanies(), { initialValue: [] });
  search = signal('');
  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  tipoPersona = signal<TipoPersona>('juridica');

  pais = signal<CodigoPais>('ES');
  /** Moneda guardada de la empresa en edición: se ofrece aunque no esté entre las del país. */
  private monedaGuardada = signal<string | null>(null);

  paisActual = computed(() => paisPorCodigo(this.pais()));
  regionesDisponibles = computed(() => this.paisActual().regiones);
  monedasDisponibles = computed(() => {
    const permitidas = this.paisActual().monedasPermitidas;
    const guardada = this.monedaGuardada();
    return guardada && !permitidas.includes(guardada) ? [...permitidas, guardada] : permitidas;
  });
  verifactuPermitido = computed(() => verifactuDisponible(this.pais()));

  /** El id fiscal español distingue CIF/NIF; en el resto la etiqueta sale del catálogo (NIT, RUT, RFC). */
  cifLabel = computed(() =>
    this.pais() === 'ES' ? (this.tipoPersona() === 'juridica' ? 'CIF' : 'NIF') : this.paisActual().etiquetaIdFiscal,
  );
  cifPlaceholder = computed(() => {
    switch (this.pais()) {
      case 'CO': return '900123456-7';
      case 'CL': return '12.345.678-5';
      case 'MX': return 'XAXX010101000';
      default: return this.tipoPersona() === 'juridica' ? 'B12345678' : '12345678A';
    }
  });

  filteredCompanies = computed(() => {
    const q = this.search().toLowerCase();
    return !q
      ? this.companies()
      : this.companies().filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            (c.ciudad ?? '').toLowerCase().includes(q)
        );
  });

  form = this.fb.group({
    name: ['', Validators.required],
    tipoPersona: ['juridica' as TipoPersona, Validators.required],
    pais: ['ES' as CodigoPais, Validators.required],
    region: ['madrid', Validators.required],
    moneda: ['EUR', Validators.required],
    rubro: ['abogados' as Company['rubro'], Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', Validators.required],
    direccion: ['', Validators.required],
    codigoPostal: ['', Validators.required],
    ciudad: ['', Validators.required],
    cif: [''],
    website: [''],
    descripcion: [''],
    plan: ['free' as Company['plan'], Validators.required],
    status: ['active' as Company['status'], Validators.required],
    verifactuEnabled: [false],
    verifactuSandbox: [true],
    // Suscripción (plan comercial real). Vacío = sin suscripción → empresa legada, equivale a Pro.
    susPlan: ['' as 'free' | 'pro' | 'enterprise' | 'demo' | ''],
    susEstado: ['activa' as 'prueba' | 'activa' | 'vencida' | 'cancelada'],
    susPeriodoFin: [''],
  });

  readonly complementoEntries = Object.entries(COMPLEMENTOS).map(([id, c]) => ({ id: id as ComplementoId, nombre: c.nombre }));
  readonly complementosSel = signal<ComplementoId[]>([]);

  toggleComplemento(id: ComplementoId, marcado: boolean): void {
    this.complementosSel.update(l => marcado ? [...new Set([...l, id])] : l.filter(x => x !== id));
  }

  constructor() {
    this.form.get('tipoPersona')!.valueChanges.subscribe(v => {
      this.tipoPersona.set((v ?? 'juridica') as TipoPersona);
    });
    this.form.get('pais')!.valueChanges.subscribe(v => this.alCambiarPais((v ?? 'ES') as CodigoPais));
  }

  /** Al cambiar de país se reinician región (la capital) y moneda (la local); Verifactu solo existe en España. */
  private alCambiarPais(pais: CodigoPais): void {
    this.pais.set(pais);
    const p = paisPorCodigo(pais);
    this.form.patchValue({ region: p.regionCapital, moneda: p.moneda }, { emitEvent: false });
    this.actualizarVerifactu(pais);
  }

  private actualizarVerifactu(pais: CodigoPais): void {
    const enabled = this.form.controls.verifactuEnabled;
    if (verifactuDisponible(pais)) {
      enabled.enable({ emitEvent: false });
    } else {
      enabled.setValue(false, { emitEvent: false });
      enabled.disable({ emitEvent: false });
    }
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ pais: 'ES', region: 'madrid', moneda: 'EUR', rubro: 'abogados', tipoPersona: 'juridica', plan: 'free', status: 'active', verifactuEnabled: false, verifactuSandbox: true });
    this.complementosSel.set([]);
    this.tipoPersona.set('juridica');
    this.pais.set('ES');
    this.monedaGuardada.set(null);
    this.actualizarVerifactu('ES');
    this.showForm.set(true);
  }

  openEdit(company: Company): void {
    this.editingId.set(company.id!);
    const tipo = company.tipoPersona ?? 'juridica';
    const sus = formDesdeSuscripcion(company.suscripcion);
    const pais = paisDeEmpresa(company);
    const moneda = monedaDeEmpresa(company);
    this.tipoPersona.set(tipo);
    this.pais.set(pais);
    this.monedaGuardada.set(moneda);
    this.form.patchValue({
      name: company.name,
      tipoPersona: tipo,
      pais,
      region: regionDeEmpresa(company) ?? paisPorCodigo(pais).regionCapital,
      moneda,
      rubro: company.rubro,
      email: company.email,
      telefono: company.telefono,
      direccion: company.direccion,
      codigoPostal: company.codigoPostal,
      ciudad: company.ciudad ?? '',
      cif: company.cif ?? '',
      website: company.website ?? '',
      descripcion: company.descripcion ?? '',
      plan: company.plan,
      status: company.status,
      verifactuEnabled: company.verifactu?.enabled ?? false,
      verifactuSandbox: company.verifactu?.sandbox ?? true,
      susPlan: sus.plan,
      susEstado: sus.estado,
      susPeriodoFin: sus.periodoFin,
    });
    this.complementosSel.set(sus.complementos);
    this.actualizarVerifactu(pais);
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const id = this.editingId();
    const pais = raw.pais!;
    const payload = {
      name: raw.name!,
      tipoPersona: raw.tipoPersona!,
      pais,
      moneda: raw.moneda!,
      // En edición se borra la región del país anterior (`ca` <-> `region`); en el alta no hay nada que borrar.
      ...geoParaGuardar(pais, raw.region!, id ? deleteField() : undefined),
      rubro: raw.rubro!,
      email: raw.email!,
      telefono: raw.telefono!,
      direccion: raw.direccion!,
      codigoPostal: raw.codigoPostal!,
      ciudad: raw.ciudad!,
      cif: raw.cif || undefined,
      website: raw.website || undefined,
      descripcion: raw.descripcion || undefined,
      plan: raw.plan!,
      status: raw.status!,
      verifactu: { enabled: verifactuDisponible(pais) && !!raw.verifactuEnabled, sandbox: !!raw.verifactuSandbox },
      suscripcion: suscripcionDesdeForm(
        {
          plan: raw.susPlan ?? '',
          estado: raw.susEstado ?? 'activa',
          periodoFin: raw.susPeriodoFin ?? '',
          complementos: this.complementosSel(),
        },
        this.companies().find(c => c.id === this.editingId())?.suscripcion,
      ),
    };

    const op$ = id
      ? this.svc.updateCompany(id, payload as Parameters<SuperuserService['updateCompany']>[1])
      : this.svc.createCompany(payload as Parameters<SuperuserService['createCompany']>[0]);

    op$.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.toast.success(id ? 'Empresa actualizada' : 'Empresa creada');
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.fromError(err, { title: 'No se pudo guardar la empresa', retry: () => this.save() });
      },
    });
  }

  /** Entra a la empresa como si el superusuario fuera miembro. */
  entrar(id: string | undefined): void {
    if (!id) return;
    this.companyService.entrarComoSuperuser(id);
  }

  delete(id: string | undefined): void {
    if (!id) return;
    this.svc.deleteCompany(id).subscribe({
      next: () => this.toast.success('Empresa eliminada'),
      error: (err) => this.toast.fromError(err, { title: 'No se pudo eliminar la empresa', retry: () => this.delete(id) }),
    });
  }

  etiquetas(company: Company): { plan: string; marcas: string[] } {
    return etiquetasEmpresa(company, new Date());
  }

  formatDate(value: Company['createdAt']): string {
    if (!value) return '—';
    const date = 'toDate' in value ? (value as { toDate(): Date }).toDate() : new Date(value as Date);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
