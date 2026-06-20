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
  LucideAngularModule,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-angular';
import { CA_LABELS, Company, CompanyPlan, RUBRO_LABELS } from '../../../interfaces/company';
import { SuperuserService } from '../../../services/superuser';
import { ToastService } from '../../../core/services/toast.service';

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

  readonly caLabels = CA_LABELS;
  readonly rubroLabels = RUBRO_LABELS;
  readonly caEntries = Object.entries(CA_LABELS) as [keyof typeof CA_LABELS, string][];

  private fb = inject(FormBuilder);
  private svc = inject(SuperuserService);
  private readonly toast = inject(ToastService);

  companies = toSignal(this.svc.getCompanies(), { initialValue: [] });
  search = signal('');
  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);

  filteredCompanies = computed(() => {
    const q = this.search().toLowerCase();
    return !q
      ? this.companies()
      : this.companies().filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.ciudad.toLowerCase().includes(q)
        );
  });

  form = this.fb.group({
    name: ['', Validators.required],
    ca: ['madrid' as Company['ca'], Validators.required],
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
  });

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ ca: 'madrid', rubro: 'abogados', plan: 'free', status: 'active' });
    this.showForm.set(true);
  }

  openEdit(company: Company): void {
    this.editingId.set(company.id!);
    this.form.patchValue({
      name: company.name,
      ca: company.ca,
      rubro: company.rubro,
      email: company.email,
      telefono: company.telefono,
      direccion: company.direccion,
      codigoPostal: company.codigoPostal,
      ciudad: company.ciudad,
      cif: company.cif ?? '',
      website: company.website ?? '',
      descripcion: company.descripcion ?? '',
      plan: company.plan,
      status: company.status,
    });
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name!,
      ca: raw.ca!,
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
    };

    const id = this.editingId();
    const op$ = id ? this.svc.updateCompany(id, payload) : this.svc.createCompany(payload);

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

  delete(id: string | undefined): void {
    if (!id) return;
    this.svc.deleteCompany(id).subscribe({
      next: () => this.toast.success('Empresa eliminada'),
      error: (err) => this.toast.fromError(err, { title: 'No se pudo eliminar la empresa', retry: () => this.delete(id) }),
    });
  }

  getPlanClass(plan: CompanyPlan): string {
    const map: Record<CompanyPlan, string> = {
      free: 'bg-slate-700 text-slate-300',
      pro: 'bg-violet-500/20 text-violet-300',
      enterprise: 'bg-amber-500/20 text-amber-300',
    };
    return map[plan];
  }

  formatDate(value: Company['createdAt']): string {
    if (!value) return '—';
    const date = 'toDate' in value ? (value as { toDate(): Date }).toDate() : new Date(value as Date);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
