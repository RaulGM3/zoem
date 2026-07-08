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
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FIRM_ROLES,
  type CompanyMember,
  type FirmRole,
  type MemberEstado,
} from '../../../../interfaces/member';
import { PermissionService } from '../../../../core/services/permission.service';
import { CustomRolesService } from '../../../../core/services/custom-roles.service';
import {
  isCellGrantable,
  MODULOS,
  CAPABILITIES,
  type Capability,
  type Modulo,
  type UserPermissionOverrides,
} from '../../../../core/permissions/permissions';

export interface UserEditPatch {
  nombre: string;
  apellido?: string;
  telefono?: string;
  departamento: string;
  role: FirmRole;
  estado: MemberEstado;
  tarifaHoraria?: number;
  permissionOverrides?: UserPermissionOverrides;
  /** id del rol custom asignado, o null para limpiar (queda el rol base). */
  customRoleId?: string | null;
}

/** Estado de una celda de override: hereda del rol, concede o revoca. */
type OverrideState = 'heredar' | 'permitir' | 'denegar';

@Component({
  selector: 'app-user-edit-drawer',
  imports: [LucideAngularModule, ReactiveFormsModule],
  templateUrl: './user-edit-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserEditDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly permissionService = inject(PermissionService);
  private readonly customRolesService = inject(CustomRolesService);

  readonly customRoles = this.customRolesService.roles;

  readonly member = input<CompanyMember | null>(null);
  readonly visible = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly canDelete = input<boolean>(true);
  /** Solo el admin ve y edita los permisos individuales. */
  readonly canEditOverrides = input<boolean>(false);

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

  readonly modulos = MODULOS;
  readonly capabilities = CAPABILITIES;
  /** Copia editable de los overrides del miembro. */
  readonly overrides = signal<UserPermissionOverrides>({});
  /** Rol seleccionado en el select: un FirmRole base o `custom:{id}`. */
  readonly roleKey = signal<string>('Usuario');

  readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    apellido: [''],
    telefono: ['', Validators.pattern(/^\+?[\d\s\-().]{6,20}$/)],
    departamento: [''],
    role: ['Usuario' as FirmRole, Validators.required],
    estado: ['activo' as MemberEstado, Validators.required],
    tarifaHoraria: [null as number | null, Validators.min(0)],
  });

  readonly title = computed(() => this.member()?.nombre ?? 'Editar usuario');

  /** Rol seleccionado en el form, como signal (para ocultar overrides si es Admin). */
  private readonly formRole = toSignal(this.form.controls.role.valueChanges, {
    initialValue: this.form.controls.role.value,
  });

  /** Los overrides solo aplican a roles no-Admin (Admin es inmune por diseño). */
  readonly showOverrides = computed(() => this.canEditOverrides() && this.formRole() !== 'Admin');

  readonly overridesCount = computed(() =>
    Object.values(this.overrides()).reduce((acc, caps) => acc + Object.keys(caps ?? {}).length, 0),
  );

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
      this.overrides.set(structuredClone(m.permissionOverrides ?? {}));
      this.roleKey.set(m.customRoleId ? `custom:${m.customRoleId}` : m.role);
      this.confirmingDelete.set(false);
    });
  }

  /**
   * Cambio en el select de rol: si es custom, el form guarda su rol BASE
   * (lo que ven las rules); el id custom viaja aparte en el patch.
   */
  onRoleKeyChange(key: string): void {
    this.roleKey.set(key);
    if (key.startsWith('custom:')) {
      const custom = this.customRolesService.byId(key.slice('custom:'.length));
      this.form.controls.role.setValue(custom?.baseRole ?? 'Usuario');
    } else {
      this.form.controls.role.setValue(key as FirmRole);
    }
  }

  // --- Permisos individuales ---

  stateOf(modulo: Modulo, cap: Capability): OverrideState {
    const value = this.overrides()[modulo]?.[cap];
    return value === undefined ? 'heredar' : value ? 'permitir' : 'denegar';
  }

  /** Valor que hereda del rol (matriz de empresa y rol custom incluidos). */
  inheritedValue(modulo: Modulo, cap: Capability): boolean {
    const role = this.formRole();
    const key = this.roleKey();
    if (key.startsWith('custom:')) {
      const custom = this.customRolesService.byId(key.slice('custom:'.length));
      const fromCustom = custom?.matrix[modulo]?.[cap];
      if (fromCustom !== undefined) return fromCustom;
    }
    return this.permissionService.effectivePermisos()[modulo]?.[role]?.[cap] ?? false;
  }

  /** Cicla heredar → permitir → denegar → heredar. Salta "permitir" si las rules lo impedirían. */
  cycle(modulo: Modulo, cap: Capability): void {
    const role = this.formRole();
    const grantable = role === 'Admin' ? false : isCellGrantable(modulo, role, cap);
    const current = this.stateOf(modulo, cap);
    const next: OverrideState =
      current === 'heredar' ? (grantable ? 'permitir' : 'denegar')
      : current === 'permitir' ? 'denegar'
      : 'heredar';
    this.overrides.update(prev => {
      const copy = structuredClone(prev);
      if (next === 'heredar') {
        delete copy[modulo]?.[cap];
        if (copy[modulo] && Object.keys(copy[modulo]).length === 0) delete copy[modulo];
      } else {
        (copy[modulo] ??= {})[cap] = next === 'permitir';
      }
      return copy;
    });
  }

  clearOverrides(): void {
    this.overrides.set({});
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
    if (this.canEditOverrides()) {
      // Se reescribe el mapa completo: heredar = clave ausente, y un mapa vacío
      // limpia los overrides anteriores. Para Admin se vacía (es inmune).
      patch.permissionOverrides = v.role === 'Admin' ? {} : this.overrides();
      const key = this.roleKey();
      patch.customRoleId = key.startsWith('custom:') ? key.slice('custom:'.length) : null;
    }
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
