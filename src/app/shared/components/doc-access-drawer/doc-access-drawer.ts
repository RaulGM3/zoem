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
import { LucideAngularModule, X, Lock, Save } from 'lucide-angular';
import { UsersService } from '../../../core/services/users';
import { FIRM_ROLES_MATRIZ, type ConfigurableRole } from '../../../core/permissions/permissions';
import type { PlantillaVisibility } from '../../../interfaces/plantilla-file.interface';
import type { FirmRole } from '../../../interfaces/member';

export interface DocAccessState {
  /** modo 'clasificado': true = restringido. modo 'visibilidad': restricted. */
  restricted: boolean;
  allowedUserIds: string[];
  /** Solo en modo 'visibilidad'. */
  allowedRoles: FirmRole[];
}

/**
 * Drawer para gestionar quién ve un documento sensible.
 * - modo `clasificado`: toggle + allowlist de usuarios (docs de casos/contactos).
 * - modo `visibilidad`: todos/restringido + roles + usuarios (plantillas).
 * Solo el Admin puede abrirlo (las rules además lo enforcen en servidor).
 */
@Component({
  selector: 'app-doc-access-drawer',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="fixed inset-0 bg-black/30 z-40" (click)="closed.emit()" aria-hidden="true"></div>
    }
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-access-title"
      [class]="'fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col transition-transform duration-300 ' + (visible() ? 'translate-x-0' : 'translate-x-full')"
    >
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <lucide-icon [img]="LockIcon" class="w-4 h-4 text-amber-600" />
          </div>
          <h2 id="doc-access-title" class="text-base font-semibold text-slate-800 truncate">
            Acceso · {{ title() }}
          </h2>
        </div>
        <button (click)="closed.emit()" class="p-1.5 hover:bg-slate-100 rounded-lg" aria-label="Cerrar">
          <lucide-icon [img]="XIcon" class="w-4 h-4 text-slate-700" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <label class="flex items-center justify-between gap-3 cursor-pointer">
          <span>
            <span class="block text-sm font-medium text-slate-700">{{ restrictedLabel() }}</span>
            <span class="block text-xs text-slate-500">{{ restrictedHint() }}</span>
          </span>
          <input
            type="checkbox"
            class="h-4 w-4 accent-violet-600"
            [checked]="restricted()"
            (change)="restricted.set($any($event.target).checked)"
          />
        </label>

        @if (restricted()) {
          @if (mode() === 'visibilidad') {
            <div>
              <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Roles con acceso</p>
              <div class="flex flex-wrap gap-2">
                @for (rol of roles; track rol) {
                  <button
                    type="button"
                    (click)="toggleRole(rol)"
                    class="px-2.5 py-1 text-xs font-medium rounded-full border transition-colors"
                    [class]="selectedRoles().includes(rol)
                      ? 'bg-violet-100 text-violet-700 border-violet-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
                    [attr.aria-pressed]="selectedRoles().includes(rol)"
                  >
                    {{ rol }}
                  </button>
                }
              </div>
            </div>
          }

          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Usuarios con acceso</p>
            <ul class="space-y-1.5">
              @for (m of activeMembers(); track m.id) {
                <li>
                  <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      class="h-4 w-4 accent-violet-600"
                      [checked]="selectedUserIds().includes(m.userId)"
                      (change)="toggleUser(m.userId)"
                    />
                    <span class="min-w-0">
                      <span class="block text-sm text-slate-700 truncate">{{ m.nombre }} {{ m.apellido ?? '' }}</span>
                      <span class="block text-xs text-slate-500 truncate">{{ m.email }} · {{ m.role }}</span>
                    </span>
                  </label>
                </li>
              } @empty {
                <li class="text-sm text-slate-500">No hay miembros activos.</li>
              }
            </ul>
            <p class="text-xs text-slate-400 mt-2">Los administradores siempre tienen acceso.</p>
          </div>
        }
      </div>

      <div class="border-t border-slate-200 px-6 py-4">
        <button
          type="button"
          (click)="save()"
          [disabled]="saving()"
          class="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50"
        >
          <lucide-icon [img]="SaveIcon" class="w-4 h-4" />
          {{ saving() ? 'Guardando...' : 'Guardar acceso' }}
        </button>
      </div>
    </div>
  `,
})
export class DocAccessDrawerComponent {
  private readonly usersService = inject(UsersService);

  readonly visible = input.required<boolean>();
  readonly mode = input<'clasificado' | 'visibilidad'>('clasificado');
  readonly title = input<string>('');
  readonly saving = input<boolean>(false);
  readonly initialRestricted = input<boolean>(false);
  readonly initialUserIds = input<string[]>([]);
  readonly initialRoles = input<FirmRole[]>([]);

  readonly saved = output<DocAccessState>();
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly LockIcon = Lock;
  readonly SaveIcon = Save;
  readonly roles: ConfigurableRole[] = FIRM_ROLES_MATRIZ;

  readonly restricted = signal(false);
  readonly selectedUserIds = signal<string[]>([]);
  readonly selectedRoles = signal<FirmRole[]>([]);

  readonly activeMembers = computed(() =>
    this.usersService.members().filter(m => m.estado === 'activo' && m.role !== 'Admin'),
  );

  readonly restrictedLabel = computed(() =>
    this.mode() === 'clasificado' ? 'Documento clasificado' : 'Visibilidad restringida',
  );
  readonly restrictedHint = computed(() =>
    this.mode() === 'clasificado'
      ? 'Solo los administradores y los usuarios elegidos podrán verlo.'
      : 'Solo los administradores, roles y usuarios elegidos podrán verla.',
  );

  constructor() {
    // Repoblar el estado local cada vez que se abre para otro documento.
    effect(() => {
      if (!this.visible()) return;
      this.restricted.set(this.initialRestricted());
      this.selectedUserIds.set([...this.initialUserIds()]);
      this.selectedRoles.set([...this.initialRoles()]);
    });
  }

  toggleUser(userId: string): void {
    this.selectedUserIds.update(list =>
      list.includes(userId) ? list.filter(id => id !== userId) : [...list, userId],
    );
  }

  toggleRole(role: FirmRole): void {
    this.selectedRoles.update(list =>
      list.includes(role) ? list.filter(r => r !== role) : [...list, role],
    );
  }

  save(): void {
    this.saved.emit({
      restricted: this.restricted(),
      allowedUserIds: this.restricted() ? this.selectedUserIds() : [],
      allowedRoles: this.restricted() ? this.selectedRoles() : [],
    });
  }
}
