import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule, X, Shield, Save, Trash2 } from 'lucide-angular';
import { PermissionService } from '../../../../core/services/permission.service';
import {
  CAPABILITIES,
  FIRM_ROLES_MATRIZ,
  MODULOS,
  isCellGrantable,
  type Capability,
  type ConfigurableRole,
  type CustomRoleDef,
  type CustomRoleMatrix,
  type Modulo,
  type RoleCaps,
} from '../../../../core/permissions/permissions';

/**
 * Crear/editar un rol custom de la empresa. El rol se ancla a un rol BASE
 * (lo que ven las security rules); la matriz fina solo puede conceder dentro
 * del envelope del rol base — revocar siempre es válido.
 */
@Component({
  selector: 'app-role-editor-drawer',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="fixed inset-0 bg-black/30 z-40" (click)="closed.emit()" aria-hidden="true"></div>
    }
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-editor-title"
      [class]="'fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-xl flex flex-col transition-transform duration-300 ' + (visible() ? 'translate-x-0' : 'translate-x-full')"
    >
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
            <lucide-icon [img]="ShieldIcon" class="w-4 h-4 text-teal-600" />
          </div>
          <h2 id="role-editor-title" class="text-base font-semibold text-slate-800 truncate">
            {{ role() ? 'Editar rol: ' + role()!.nombre : 'Nuevo rol' }}
          </h2>
        </div>
        <button (click)="closed.emit()" class="p-1.5 hover:bg-slate-100 rounded-lg" aria-label="Cerrar">
          <lucide-icon [img]="XIcon" class="w-4 h-4 text-slate-700" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div class="space-y-1.5">
          <label for="role-nombre" class="text-sm font-medium text-slate-700">
            Nombre <span class="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="role-nombre"
            type="text"
            [value]="nombre()"
            (input)="nombre.set($any($event.target).value)"
            placeholder="Ej. Paralegal, Contable, Becario..."
            class="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>

        <div class="space-y-1.5">
          <label for="role-desc" class="text-sm font-medium text-slate-700">Descripción</label>
          <input
            id="role-desc"
            type="text"
            [value]="descripcion()"
            (input)="descripcion.set($any($event.target).value)"
            class="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>

        <div class="space-y-1.5">
          <label for="role-base" class="text-sm font-medium text-slate-700">Rol base (seguridad)</label>
          <select
            id="role-base"
            [value]="baseRole()"
            (change)="onBaseRoleChange($any($event.target).value)"
            class="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            @for (r of baseRoles; track r) {
              <option [value]="r" [selected]="r === baseRole()">{{ r }}</option>
            }
          </select>
          <p class="text-xs text-slate-500">
            Define el límite de seguridad del servidor: el rol custom solo puede refinar
            DENTRO de lo que su rol base permite. Cambiarlo reinicia la matriz.
          </p>
        </div>

        <div>
          <p class="text-sm font-medium text-slate-700 mb-1">Permisos del rol</p>
          <p class="text-xs text-slate-500 mb-2">
            Toca una celda para alternar. Las celdas atenuadas no son concedibles para este rol base.
          </p>
          <table class="w-full text-xs">
            <thead>
              <tr class="text-slate-500 border-b border-slate-100">
                <th class="pb-1.5 text-left font-medium">Módulo</th>
                @for (cap of capabilities; track cap) {
                  <th class="pb-1.5 font-medium text-center capitalize">{{ cap }}</th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              @for (modulo of modulos; track modulo) {
                <tr>
                  <td class="py-1.5 text-slate-700 font-medium">{{ modulo }}</td>
                  @for (cap of capabilities; track cap) {
                    <td class="py-1.5 text-center">
                      <button
                        type="button"
                        (click)="toggle(modulo, cap)"
                        [disabled]="!isEditable(modulo, cap)"
                        class="w-7 h-6 rounded text-[11px] font-semibold transition-colors disabled:cursor-not-allowed"
                        [class]="caps()[modulo][cap]
                          ? 'bg-emerald-100 text-emerald-700'
                          : isEditable(modulo, cap)
                            ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            : 'bg-slate-50 text-slate-200'"
                        [attr.aria-pressed]="caps()[modulo][cap]"
                        [attr.aria-label]="cap + ' en ' + modulo + ': ' + (caps()[modulo][cap] ? 'permitido' : 'denegado')"
                      >
                        {{ caps()[modulo][cap] ? '✓' : '—' }}
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="border-t border-slate-200 px-6 py-4 space-y-3">
        <button
          type="button"
          (click)="save()"
          [disabled]="saving() || !nombre().trim()"
          class="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50"
        >
          <lucide-icon [img]="SaveIcon" class="w-4 h-4" />
          {{ saving() ? 'Guardando...' : 'Guardar rol' }}
        </button>
        @if (role()) {
          @if (confirmingDelete()) {
            <div class="flex items-center gap-2">
              <span class="text-sm text-slate-600 flex-1">Los usuarios con este rol pasarán a su rol base. ¿Eliminar?</span>
              <button
                (click)="deleted.emit(role()!.id)"
                [disabled]="saving()"
                class="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Sí
              </button>
              <button
                (click)="confirmingDelete.set(false)"
                class="px-3 py-1.5 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                No
              </button>
            </div>
          } @else {
            <button
              (click)="confirmingDelete.set(true)"
              class="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700"
            >
              <lucide-icon [img]="Trash2Icon" class="w-4 h-4" />
              Eliminar rol
            </button>
          }
        }
      </div>
    </div>
  `,
})
export class RoleEditorDrawerComponent {
  private readonly permissionService = inject(PermissionService);

  readonly visible = input.required<boolean>();
  readonly saving = input<boolean>(false);
  /** null = crear rol nuevo. */
  readonly role = input<CustomRoleDef | null>(null);

  readonly saved = output<CustomRoleDef>();
  readonly deleted = output<string>();
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly ShieldIcon = Shield;
  readonly SaveIcon = Save;
  readonly Trash2Icon = Trash2;

  readonly modulos = MODULOS;
  readonly capabilities = CAPABILITIES;
  readonly baseRoles = FIRM_ROLES_MATRIZ;

  readonly nombre = signal('');
  readonly descripcion = signal('');
  readonly baseRole = signal<ConfigurableRole>('Usuario');
  /** Grid completo editable (matriz efectiva del rol). */
  readonly caps = signal<Record<Modulo, RoleCaps>>(this.effectiveFor('Usuario', {}));
  readonly confirmingDelete = signal(false);

  /** Base de herencia (rol base + matriz de empresa): el diff se calcula contra esto. */
  private readonly inheritedCaps = computed(() => {
    const eff = this.permissionService.effectivePermisos();
    const base = this.baseRole();
    const result = {} as Record<Modulo, RoleCaps>;
    for (const m of MODULOS) result[m] = { ...eff[m][base] };
    return result;
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const r = this.role();
      this.nombre.set(r?.nombre ?? '');
      this.descripcion.set(r?.descripcion ?? '');
      this.baseRole.set(r?.baseRole ?? 'Usuario');
      this.caps.set(this.effectiveFor(r?.baseRole ?? 'Usuario', r?.matrix ?? {}));
      this.confirmingDelete.set(false);
    });
  }

  private effectiveFor(base: ConfigurableRole, matrix: CustomRoleMatrix): Record<Modulo, RoleCaps> {
    const eff = this.permissionService.effectivePermisos();
    const result = {} as Record<Modulo, RoleCaps>;
    for (const m of MODULOS) result[m] = { ...eff[m][base], ...matrix[m] };
    return result;
  }

  onBaseRoleChange(base: ConfigurableRole): void {
    this.baseRole.set(base);
    this.caps.set(this.effectiveFor(base, {}));
  }

  /** Editable si está activa (revocar siempre vale) o si las rules permiten concederla. */
  isEditable(modulo: Modulo, cap: Capability): boolean {
    return this.caps()[modulo][cap] || isCellGrantable(modulo, this.baseRole(), cap);
  }

  toggle(modulo: Modulo, cap: Capability): void {
    if (!this.isEditable(modulo, cap)) return;
    this.caps.update(prev => ({
      ...prev,
      [modulo]: { ...prev[modulo], [cap]: !prev[modulo][cap] },
    }));
  }

  save(): void {
    // Delta sparse contra la herencia (rol base + empresa): las celdas no
    // tocadas siguen heredando cambios futuros de la matriz de empresa.
    const inherited = this.inheritedCaps();
    const matrix: CustomRoleMatrix = {};
    for (const m of MODULOS) {
      for (const cap of CAPABILITIES) {
        if (this.caps()[m][cap] !== inherited[m][cap]) {
          (matrix[m] ??= {})[cap] = this.caps()[m][cap];
        }
      }
    }
    this.saved.emit({
      id: this.role()?.id ?? crypto.randomUUID(),
      nombre: this.nombre().trim(),
      ...(this.descripcion().trim() ? { descripcion: this.descripcion().trim() } : {}),
      baseRole: this.baseRole(),
      matrix,
    });
  }
}
