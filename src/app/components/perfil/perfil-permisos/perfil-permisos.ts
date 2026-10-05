import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule, Check, X, ShieldCheck } from 'lucide-angular';
import type { Capability, Modulo } from '../../../core/permissions/permissions';
import type { FirmRole } from '../../../interfaces/member';

export interface RolInfo {
  label: string;
  colorClass: string;
  descripcion: string;
  /** Rol base cuando el usuario tiene un rol custom; null si usa un rol base. */
  baseRole: FirmRole | null;
}

export interface ModuloPermisos {
  modulo: Modulo;
  label: string;
  caps: { cap: Capability; label: string; granted: boolean }[];
}

/** Presentacional: rol del usuario en la empresa y sus permisos efectivos por módulo. */
@Component({
  selector: 'app-perfil-permisos',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5 p-4 sm:p-5">
      <section class="space-y-2" aria-labelledby="perfil-rol-titulo">
        <h2 id="perfil-rol-titulo" class="text-sm font-semibold" style="color:var(--text-strong)">
          Tu rol{{ empresa() ? ' en ' + empresa() : '' }}
        </h2>
        @if (rol(); as r) {
          <div class="flex flex-wrap items-center gap-2">
            <lucide-icon [img]="ShieldCheckIcon" class="h-4 w-4" style="color:var(--brand)" aria-hidden="true" />
            <span data-test="rol-badge" class="rounded-full px-3 py-0.5 text-xs font-semibold" [class]="r.colorClass">{{ r.label }}</span>
            @if (r.baseRole) {
              <span data-test="rol-base" class="text-xs" style="color:var(--text-muted)">basado en {{ r.baseRole }}</span>
            }
          </div>
          @if (r.descripcion) {
            <p class="text-sm" style="color:var(--text-body)">{{ r.descripcion }}</p>
          }
        } @else {
          <p class="text-sm" style="color:var(--text-muted)">Sin rol asignado en esta empresa.</p>
        }
      </section>

      <section class="space-y-2" aria-labelledby="perfil-permisos-titulo">
        <h2 id="perfil-permisos-titulo" class="text-sm font-semibold" style="color:var(--text-strong)">Qué puedes hacer</h2>
        <ul class="divide-y rounded-lg" style="border:1px solid var(--border);border-color:var(--border)">
          @for (m of permisos(); track m.modulo) {
            <li data-test="permiso-modulo"
              class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              style="border-color:var(--border)">
              <span class="text-sm font-medium" style="color:var(--text-strong)">{{ m.label }}</span>
              @if (sinAcceso(m)) {
                <span class="text-xs font-medium" style="color:var(--text-muted)">Sin acceso</span>
              }
              <ul class="flex flex-wrap gap-1.5" [attr.aria-label]="'Permisos en ' + m.label">
                @for (c of m.caps; track c.cap) {
                  <li data-test="permiso-cap" [attr.data-granted]="c.granted"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    [style.background]="c.granted ? 'color-mix(in srgb,var(--success) 14%,transparent)' : 'var(--surface-2)'"
                    [style.color]="c.granted ? 'var(--text-strong)' : 'var(--text-muted)'">
                    <lucide-icon [img]="c.granted ? CheckIcon : XIcon" class="h-3 w-3" aria-hidden="true"
                      [style.color]="c.granted ? 'var(--success)' : 'var(--text-muted)'" />
                    {{ c.label }}<span class="sr-only">: {{ c.granted ? 'permitido' : 'no permitido' }}</span>
                  </li>
                }
              </ul>
            </li>
          }
        </ul>
        <p class="text-xs" style="color:var(--text-muted)">
          ¿Necesitas más acceso? Pídeselo al administrador de tu empresa.
        </p>
      </section>
    </div>
  `,
})
export class PerfilPermisosComponent {
  readonly CheckIcon = Check;
  readonly XIcon = X;
  readonly ShieldCheckIcon = ShieldCheck;

  readonly rol = input<RolInfo | null>(null);
  readonly permisos = input<ModuloPermisos[]>([]);
  readonly empresa = input<string | null>(null);

  sinAcceso(m: ModuloPermisos): boolean {
    return m.caps.every((c) => !c.granted);
  }
}
