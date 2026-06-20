import { Component, signal, computed, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import {
  LucideAngularModule, UserCog, Plus,
  Mail, Clock, Trash2, Copy, Check,
} from 'lucide-angular';
import { Timestamp } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import { InvitationService } from '../../core/services/invitation.service';
import { ToastService } from '../../core/services/toast.service';
import { CompanyService } from '../../core/services/company.service';
import { SearchService } from '../../core/services/search.service';
import { ActividadService } from '../../core/services/actividad.service';
import { FIRM_ROLE_COLORS, type CompanyMember, type FirmRole } from '../../interfaces/member';
import type { CompanyInvitation } from '../../interfaces/invitation';
import type { Actividad } from '../../interfaces/actividad';
import type { Capability, Modulo, RoleCaps } from '../../core/permissions/permissions';
import { InviteDrawerComponent, type InviteFormData } from './components/invite-drawer/invite-drawer';
import { UserEditDrawerComponent, type UserEditPatch } from './components/user-edit-drawer/user-edit-drawer';

type UsuariosTab = 'usuarios' | 'roles' | 'permisos';

@Component({
  selector: 'app-usuarios',
  imports: [LucideAngularModule, InviteDrawerComponent, UserEditDrawerComponent],
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

  private readonly usersService = inject(UsersService);
  private readonly permissionService = inject(PermissionService);
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

  // Edit drawer
  readonly showEditDrawer = signal(false);
  readonly editingMember = signal<CompanyMember | null>(null);
  readonly memberSaving = signal(false);

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
    this.inviteSaving.set(true);
    try {
      const token = await this.toast.run(
        () => this.invitationService.createInvitation(company.id, company.name, data.email, data.role, createdBy),
        { errorTitle: 'No se pudo crear la invitación' }
      );
      if (token === undefined) return;
      this.inviteLink.set(`${window.location.origin}/invite/${token}`);
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
        onSuccess: () => this.closeEditDrawer(),
      });
    } finally {
      this.memberSaving.set(false);
    }
  }

  async onDeleteMember(id: string): Promise<void> {
    this.memberSaving.set(true);
    try {
      await this.toast.run(() => this.usersService.removeMember(id), {
        successMessage: 'Usuario eliminado',
        errorTitle: 'No se pudo eliminar el usuario',
        onSuccess: () => this.closeEditDrawer(),
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

  /** Capacidades (ver/crear/editar/eliminar) de un rol en un módulo, para el tab "Permisos". */
  capsFor(modulo: Modulo, rol: FirmRole): RoleCaps {
    return this.permissionService.PERMISOS[modulo][rol];
  }

  /** Inicial de una capacidad para el badge compacto (V/C/E/B). */
  capInitial(cap: Capability): string {
    return cap === 'ver' ? 'V' : cap === 'crear' ? 'C' : cap === 'editar' ? 'E' : 'B';
  }
}
