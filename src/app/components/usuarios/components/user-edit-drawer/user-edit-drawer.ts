import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
  inject,
} from '@angular/core';
import { LucideAngularModule, X, UserCog, Shield, Save, Trash2 } from 'lucide-angular';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  FIRM_ROLES,
  type CompanyMember,
  type FirmRole,
  type MemberEstado,
} from '../../../../interfaces/member';

export interface UserEditPatch {
  nombre: string;
  apellido?: string;
  telefono?: string;
  departamento: string;
  role: FirmRole;
  estado: MemberEstado;
  tarifaHoraria?: number;
}

@Component({
  selector: 'app-user-edit-drawer',
  imports: [LucideAngularModule, ReactiveFormsModule],
  templateUrl: './user-edit-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserEditDrawerComponent {
  private readonly fb = inject(FormBuilder);

  readonly member = input<CompanyMember | null>(null);
  readonly visible = input.required<boolean>();
  readonly saving = input.required<boolean>();

  readonly saved = output<UserEditPatch>();
  readonly deleted = output<string>();
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly UserCogIcon = UserCog;
  readonly ShieldIcon = Shield;
  readonly SaveIcon = Save;
  readonly Trash2Icon = Trash2;

  readonly roles = FIRM_ROLES;
  readonly estados: MemberEstado[] = ['activo', 'inactivo', 'pendiente'];
  readonly confirmingDelete = signal(false);

  readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    apellido: [''],
    telefono: [''],
    departamento: [''],
    role: ['Usuario' as FirmRole, Validators.required],
    estado: ['activo' as MemberEstado, Validators.required],
    tarifaHoraria: [null as number | null, Validators.min(0)],
  });

  readonly title = computed(() => this.member()?.nombre ?? 'Editar usuario');

  constructor() {
    // Cuando cambia el miembro seleccionado, repoblar el form y resetear el estado de borrado.
    effect(() => {
      const m = this.member();
      if (!m) return;
      this.form.reset({
        nombre: m.nombre ?? '',
        apellido: m.apellido ?? '',
        telefono: m.telefono ?? '',
        departamento: m.departamento ?? '',
        role: m.role,
        estado: m.estado,
        tarifaHoraria: m.tarifaHoraria ?? null,
      });
      this.confirmingDelete.set(false);
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const tarifa = v.tarifaHoraria;
    const patch: UserEditPatch = {
      nombre: v.nombre.trim(),
      departamento: v.departamento.trim(),
      role: v.role,
      estado: v.estado,
      apellido: v.apellido.trim() || undefined,
      telefono: v.telefono.trim() || undefined,
      tarifaHoraria: tarifa === null || Number.isNaN(tarifa) ? undefined : Number(tarifa),
    };
    this.saved.emit(patch);
  }

  onDelete(): void {
    const m = this.member();
    if (m) this.deleted.emit(m.id);
  }

  close(): void {
    this.confirmingDelete.set(false);
    this.closed.emit();
  }
}
