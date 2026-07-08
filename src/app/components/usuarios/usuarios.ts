import { Component, signal, computed, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import {
  LucideAngularModule, UserCog, Plus,
  Mail, Clock, Trash2, Copy, Check, Lock, Inbox,
} from 'lucide-angular';
import { Timestamp } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import { CompanyPermissionsService } from '../../core/services/company-permissions.service';
import { CustomRolesService } from '../../core/services/custom-roles.service';
import { PermissionRequestService } from '../../core/services/permission-request.service';
import { InvitationService } from '../../core/services/invitation.service';
import { ToastService } from '../../core/services/toast.service';
import { CompanyService } from '../../core/services/company.service';
import { SearchService } from '../../core/services/search.service';
import { ActividadService } from '../../core/services/actividad.service';
import { FIRM_ROLE_COLORS, type CompanyMember, type FirmRole } from '../../interfaces/member';
import type { CompanyInvitation } from '../../interfaces/invitation';
import type { Actividad } from '../../interfaces/actividad';
import {
  diffMatrix,
  effectiveMatrix,
  isCellGrantable,
  type Capability,
  type CustomRoleDef,
  type Modulo,
  type RoleCaps,
} from '../../core/permissions/permissions';
import type { PermissionRequest } from '../../interfaces/permission-request.interface';
import { InviteDrawerComponent, type InviteFormData } from './components/invite-drawer/invite-drawer';
import { UserEditDrawerComponent, type UserEditPatch } from './components/user-edit-drawer/user-edit-drawer';
import { RoleEditorDrawerComponent } from './components/role-editor-drawer/role-editor-drawer';

type UsuariosTab = 'usuarios' | 'roles' | 'permisos' | 'solicitudes';
type EditableMatrix = Record<Modulo, Record<FirmRole, RoleCaps>>;

@Component({
  selector: 'app-usuarios',
  imports: [LucideAngularModule, InviteDrawerComponent, UserEditDrawerComponent, RoleEditorDrawerComponent],
  templateUrl: './usuarios.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosComponent implements OnInit, OnDestroy {
  readonly UserCogIcon = UserCog;
  readonly PlusIcon = Plus;
  readonly MailIcon = Mail;
  readonly ClockIcon = Clock;
  readonly Trash2Icon = Trash2;
  readonly CopyIcon = Copy;
  readonly CheckIcon = Check;
  readonly LockIcon = Lock;
  readonly InboxIcon = Inbox;

  private readonly usersService = inject(UsersService);
  private readonly permissionService = inject(PermissionService);
  private readonly companyPermsService = inject(CompanyPermissionsService);
  private readonly customRolesService = inject(CustomRolesService);
  private readonly requestService = inject(PermissionRequestService);
  private readonly invitationService = inject(InvitationService);
  private readonly toast = inject(ToastService);
  private readonly companyService = inject(CompanyService);
  private readonly searchSvc = inject(SearchService);
  private readonly actividadService = inject(ActividadService);

  private invitationsSub?: Subscription;
  private actividadSub?: Subscription;

  activeTab = signal<UsuariosTab>('usuarios');
  /** Búsqueda centralizada en el header — scopeada a "personal". */
  readonly search = this.searchSvc.termFor('personal');
  readonly actividad = signal<Actividad[]>([]);

  readonly isLoading = this.usersService.isLoading;
  readonly activos = this.usersService.activos;
  readonly pendientes = this.usersService.pendientes;
  readonly isAdmin = this.permissionService.isAdmin;
  readonly modulos = this.permissionService.MODULOS;
  readonly capabilities = this.permissionService.CAPABILITIES;
  readonly rolesCols: FirmRole[] = ['Admin', 'Gestor', 'Usuario', 'Viewer'];

  readonly roles = computed(() => this.usersService.getRoles());
  readonly totalMiembros = computed(() => this.usersService.members().length);

  // --- Editor de la matriz de permisos (tab "Permisos") ---
  /** Copia editable; null = sin cambios pendientes, se muestra la matriz efectiva. */
  readonly editedMatrix = signal<EditableMatrix | null>(null);
  readonly matrixSaving = signal(false);
  readonly matrixDirty = computed(() => this.editedMatrix() !== null);
  readonly displayMatrix = computed<EditableMatrix>(
    () => this.editedMatrix() ?? this.permissionService.effectivePermisos(),
  );
  /** ¿La empresa tiene personalizaciones guardadas sobre la matriz base? */
  readonly matrixCustomized = computed(
    () => Object.keys(diffMatrix(this.permissionService.effectivePermisos())).length > 0,
  );

  // --- Solicitudes de permiso (tab "Solicitudes") ---
  readonly solicitudesPendientes = this.requestService.pendientes;
  readonly resolvingRequestId = signal<string | null>(null);

  // --- Roles custom (tab "Roles") ---
  readonly customRoles = this.customRolesService.roles;
  readonly showRoleEditor = signal(false);
  readonly editingRole = signal<CustomRoleDef | null>(null);
  readonly roleSaving = signal(false);

  /** Cuántos miembros usan cada rol custom (para las cards). */
  countForCustomRole(id: string): number {
    return this.usersService.members().filter(m => m.customRoleId === id).length;
  }

  // Edit drawer
  readonly showEditDrawer = signal(false);
  readonly editingMember = signal<CompanyMember | null>(null);
  readonly memberSaving = signal(false);
  readonly isEditingOwnProfile = computed(() =>
    this.editingMember()?.id === this.permissionService.currentMember()?.id
  );

  // Re-copiar link de invitación
  readonly copiedInviteId = signal<string | null>(null);

  readonly filteredUsuarios = computed(() => {
    const q = this.search().toLowerCase();
    if (!q) return this.usersService.members();
    return this.usersService.members().filter(u =>
      u.nombre.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
      || (u.telefono ?? '').toLowerCase().includes(q)
    );
  });

  // Invite drawer
  readonly showInviteDrawer = signal(false);
  readonly inviteSaving = signal(false);
  readonly inviteLink = signal<string | null>(null);
  readonly pendingInvitations = signal<CompanyInvitation[]>([]);
  readonly cancellingId = signal<string | null>(null);

  readonly hasPendingInvitations = computed(() => this.pendingInvitations().length > 0);

  ngOnInit(): void {
    this.usersService.loadMembers();
    this.loadInvitations();
    this.loadActividad();
  }

  ngOnDestroy(): void {
    this.invitationsSub?.unsubscribe();
    this.actividadSub?.unsubscribe();
  }

  private loadActividad(): void {
    this.actividadSub = this.actividadService
      .recentStream(20)
      .subscribe(items => this.actividad.set(items));
  }

  private loadInvitations(): void {
    const companyId = this.companyService.activeCompany()?.id;
    if (!companyId) return;
    this.invitationsSub = this.invitationService
      .getInvitationsByCompany(companyId)
      .subscribe(invitations => {
        this.pendingInvitations.set(
          invitations.filter(i => i.status === 'pending')
        );
      });
  }

  openInviteDrawer(): void {
    this.inviteLink.set(null);
    this.showInviteDrawer.set(true);
  }

  closeInviteDrawer(): void {
    this.showInviteDrawer.set(false);
    this.inviteLink.set(null);
  }

  async onInviteSubmit(data: InviteFormData): Promise<void> {
    const company = this.companyService.activeCompany();
    const createdBy = this.permissionService.currentMember()?.email ?? '';
    if (!company) return;

    // BUG #1: usuario activo con el mismo email
    const emailNorm = data.email.toLowerCase().trim();
    const existingMember = this.usersService.members().some(m => m.email.toLowerCase() === emailNorm);
    if (existingMember) {
      this.toast.fromError(new Error('Ya existe un miembro con este correo'), { title: 'Invitación no enviada' });
      return;
    }
    // BUG #2: invitación pendiente duplicada
    const pendingDup = this.pendingInvitations().some(i => i.email === emailNorm);
    if (pendingDup) {
      this.toast.fromError(new Error('Ya existe una invitación pendiente para este correo'), { title: 'Invitación no enviada' });
      return;
    }

    this.inviteSaving.set(true);
    try {
      const token = await this.toast.run(
        () => this.invitationService.createInvitation(company.id, company.name, data.email, data.role, createdBy),
        { errorTitle: 'No se pudo crear la invitación' }
      );
      if (token === undefined) return;
      this.inviteLink.set(`${window.location.origin}/invite/${token}`);
      // BUG #9: auditoría
      void this.actividadService.log('Configuración', `Invitó a: ${data.email}`);
    } finally {
      this.inviteSaving.set(false);
    }
  }

  async cancelInvitation(id: string): Promise<void> {
    this.cancellingId.set(id);
    try {
      await this.toast.run(() => this.invitationService.cancelInvitation(id), {
        successMessage: 'Invitación cancelada',
        errorTitle: 'No se pudo cancelar la invitación',
      });
    } finally {
      this.cancellingId.set(null);
    }
  }

  /** Vuelve a copiar el enlace de una invitación pendiente (reconstruido desde su token). */
  async copyInviteLink(inv: CompanyInvitation): Promise<void> {
    const link = `${window.location.origin}/invite/${inv.token}`;
    await navigator.clipboard.writeText(link);
    this.copiedInviteId.set(inv.id ?? null);
    setTimeout(() => this.copiedInviteId.set(null), 2000);
  }

  // --- Edición de usuario (drawer) ---
  openEditDrawer(member: CompanyMember): void {
    this.editingMember.set(member);
    this.showEditDrawer.set(true);
  }

  closeEditDrawer(): void {
    this.showEditDrawer.set(false);
    this.editingMember.set(null);
  }

  async onSaveMember(patch: UserEditPatch): Promise<void> {
    const member = this.editingMember();
    if (!member) return;
    this.memberSaving.set(true);
    try {
      await this.toast.run(() => this.usersService.updateMember(member.id, patch), {
        successMessage: 'Usuario actualizado',
        errorTitle: 'No se pudo actualizar el usuario',
        onSuccess: () => {
          this.closeEditDrawer();
          // BUG #9: auditoría
          void this.actividadService.log('Configuración', `Actualizó usuario: ${member.nombre}`, member.id);
        },
      });
    } finally {
      this.memberSaving.set(false);
    }
  }

  async onDeleteMember(id: string): Promise<void> {
    // BUG #11: prevenir auto-eliminación
    if (id === this.permissionService.currentMember()?.id) {
      this.toast.fromError(new Error('No puedes eliminar tu propia cuenta'), { title: 'Acción no permitida' });
      return;
    }
    const member = this.usersService.members().find(m => m.id === id);
    this.memberSaving.set(true);
    try {
      await this.toast.run(() => this.usersService.removeMember(id), {
        successMessage: 'Usuario eliminado',
        errorTitle: 'No se pudo eliminar el usuario',
        onSuccess: () => {
          this.closeEditDrawer();
          // BUG #9: auditoría
          if (member) void this.actividadService.log('Configuración', `Eliminó usuario: ${member.nombre}`, id);
        },
      });
    } finally {
      this.memberSaving.set(false);
    }
  }

  formatLogin(ts: Timestamp | null): string {
    if (!ts) return '—';
    const date = ts.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    const hhmm = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return `Hoy, ${hhmm}`;
    if (diffDays === 1) return `Ayer, ${hhmm}`;
    return `Hace ${diffDays} días`;
  }

  formatExpiry(ts: Timestamp): string {
    const date = ts.toDate();
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      activo:   'bg-green-100 text-green-700',
      inactivo: 'bg-slate-100 text-slate-500',
      pendiente: 'bg-amber-100 text-amber-700',
    };
    return map[estado] ?? 'bg-slate-100 text-slate-600';
  }

  getRolClass(rol: string): string {
    return FIRM_ROLE_COLORS[rol as keyof typeof FIRM_ROLE_COLORS] ?? 'bg-slate-100 text-slate-600';
  }

  /** Capacidades de un rol en un módulo — matriz efectiva (o la edición en curso). */
  capsFor(modulo: Modulo, rol: FirmRole): RoleCaps {
    return this.displayMatrix()[modulo][rol];
  }

  /** Inicial de una capacidad para el badge compacto (V/C/E/B). */
  capInitial(cap: Capability): string {
    return cap === 'ver' ? 'V' : cap === 'crear' ? 'C' : cap === 'editar' ? 'E' : 'B';
  }

  // --- Editor de la matriz (solo admin) ---

  /** ¿Se puede togglear esta celda? Admin nunca; conceder fuera del envelope de rules tampoco. */
  cellEditable(modulo: Modulo, rol: FirmRole, cap: Capability): boolean {
    if (!this.isAdmin() || rol === 'Admin') return false;
    // Si está activa siempre se puede revocar; si está inactiva solo si las rules lo permiten.
    return this.capsFor(modulo, rol)[cap] || isCellGrantable(modulo, rol, cap);
  }

  toggleCell(modulo: Modulo, rol: FirmRole, cap: Capability): void {
    if (!this.cellEditable(modulo, rol, cap)) return;
    const base = this.editedMatrix() ?? structuredClone(this.permissionService.effectivePermisos());
    const copy = structuredClone(base);
    copy[modulo][rol] = { ...copy[modulo][rol], [cap]: !copy[modulo][rol][cap] };
    this.editedMatrix.set(copy);
  }

  cancelMatrixEdit(): void {
    this.editedMatrix.set(null);
  }

  async saveMatrix(): Promise<void> {
    const edited = this.editedMatrix();
    if (!edited) return;
    this.matrixSaving.set(true);
    try {
      await this.toast.run(() => this.companyPermsService.saveMatrix(diffMatrix(edited)), {
        successMessage: 'Permisos de la empresa actualizados',
        errorTitle: 'No se pudieron guardar los permisos',
        onSuccess: () => {
          this.editedMatrix.set(null);
          void this.actividadService.log('Configuración', 'Actualizó la matriz de permisos de la empresa');
        },
      });
    } finally {
      this.matrixSaving.set(false);
    }
  }

  async resetMatrix(): Promise<void> {
    this.matrixSaving.set(true);
    try {
      await this.toast.run(() => this.companyPermsService.resetDefaults(), {
        successMessage: 'Permisos restaurados a los valores por defecto',
        errorTitle: 'No se pudieron restaurar los permisos',
        onSuccess: () => {
          this.editedMatrix.set(null);
          void this.actividadService.log('Configuración', 'Restauró la matriz de permisos por defecto');
        },
      });
    } finally {
      this.matrixSaving.set(false);
    }
  }

  // --- Roles custom ---

  /** Badge de rol a mostrar: el nombre del rol custom si el miembro tiene uno. */
  roleBadge(member: CompanyMember): { label: string; colorClass: string } {
    return this.permissionService.displayRole(member);
  }

  openCreateRole(): void {
    this.editingRole.set(null);
    this.showRoleEditor.set(true);
  }

  openEditRole(role: CustomRoleDef): void {
    this.editingRole.set(role);
    this.showRoleEditor.set(true);
  }

  async onRoleSaved(role: CustomRoleDef): Promise<void> {
    this.roleSaving.set(true);
    try {
      await this.toast.run(() => this.customRolesService.saveRole(role), {
        successMessage: `Rol "${role.nombre}" guardado`,
        errorTitle: 'No se pudo guardar el rol',
        onSuccess: () => {
          this.showRoleEditor.set(false);
          this.editingRole.set(null);
          void this.actividadService.log('Configuración', `Guardó el rol custom: ${role.nombre}`);
        },
      });
    } finally {
      this.roleSaving.set(false);
    }
  }

  async onRoleDeleted(id: string): Promise<void> {
    const role = this.customRolesService.byId(id);
    this.roleSaving.set(true);
    try {
      await this.toast.run(() => this.customRolesService.deleteRole(id), {
        successMessage: 'Rol eliminado — sus usuarios conservan el rol base',
        errorTitle: 'No se pudo eliminar el rol',
        onSuccess: () => {
          this.showRoleEditor.set(false);
          this.editingRole.set(null);
          if (role) void this.actividadService.log('Configuración', `Eliminó el rol custom: ${role.nombre}`);
        },
      });
    } finally {
      this.roleSaving.set(false);
    }
  }

  // --- Solicitudes de permiso ---

  async approveRequest(req: PermissionRequest): Promise<void> {
    this.resolvingRequestId.set(req.id);
    try {
      await this.toast.run(() => this.requestService.approve(req), {
        successMessage: `Permiso concedido a ${req.userNombre}`,
        errorTitle: 'No se pudo aprobar la solicitud',
        onSuccess: () => {
          void this.actividadService.log(
            'Configuración',
            `Aprobó permiso ${req.capability}/${req.modulo} a ${req.userNombre}`,
          );
        },
      });
    } finally {
      this.resolvingRequestId.set(null);
    }
  }

  async rejectRequest(req: PermissionRequest): Promise<void> {
    this.resolvingRequestId.set(req.id);
    try {
      await this.toast.run(() => this.requestService.reject(req), {
        successMessage: 'Solicitud rechazada',
        errorTitle: 'No se pudo rechazar la solicitud',
      });
    } finally {
      this.resolvingRequestId.set(null);
    }
  }
}
