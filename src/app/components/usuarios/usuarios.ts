import { Component, signal, computed, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import {
  LucideAngularModule, UserCog, Users, Shield, Plus,
  Mail, MoreHorizontal, CheckCircle2, Clock, XCircle, Trash2,
} from 'lucide-angular';
import { Timestamp } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import { InvitationService } from '../../core/services/invitation.service';
import { CompanyService } from '../../core/services/company.service';
import { SearchService } from '../../core/services/search.service';
import { FIRM_ROLE_COLORS } from '../../interfaces/member';
import type { CompanyInvitation } from '../../interfaces/invitation';
import { InviteDrawerComponent, type InviteFormData } from './components/invite-drawer/invite-drawer';

type UsuariosTab = 'usuarios' | 'roles' | 'permisos';

const ACTIVIDAD = [
  { usuario: 'Carlos Mendoza', accion: 'Inicio de sesión', fecha: 'Hoy, 09:15' },
  { usuario: 'Ana Martínez', accion: 'Creó proyecto 2026-090', fecha: 'Hoy, 08:30' },
  { usuario: 'Laura Sánchez', accion: 'Editó contacto CON-003', fecha: 'Ayer, 17:00' },
  { usuario: 'Pedro García', accion: 'Descargó informe mensual', fecha: 'Ayer, 14:20' },
];

@Component({
  selector: 'app-usuarios',
  imports: [LucideAngularModule, InviteDrawerComponent],
  templateUrl: './usuarios.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosComponent implements OnInit, OnDestroy {
  readonly UserCogIcon = UserCog;
  readonly UsersIcon = Users;
  readonly ShieldIcon = Shield;
  readonly PlusIcon = Plus;
  readonly MailIcon = Mail;
  readonly MoreHorizontalIcon = MoreHorizontal;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly ClockIcon = Clock;
  readonly XCircleIcon = XCircle;
  readonly Trash2Icon = Trash2;

  private readonly usersService = inject(UsersService);
  private readonly permissionService = inject(PermissionService);
  private readonly invitationService = inject(InvitationService);
  private readonly companyService = inject(CompanyService);
  private readonly searchSvc = inject(SearchService);

  private invitationsSub?: Subscription;

  activeTab = signal<UsuariosTab>('usuarios');
  /** Búsqueda centralizada en el header — scopeada a "personal". */
  readonly search = this.searchSvc.termFor('personal');
  actividad = ACTIVIDAD;

  readonly isLoading = this.usersService.isLoading;
  readonly activos = this.usersService.activos;
  readonly pendientes = this.usersService.pendientes;
  readonly isAdmin = this.permissionService.isAdmin;
  readonly modulos = this.permissionService.MODULOS;
  readonly permisosMatriz = this.permissionService.PERMISOS_MATRIZ;

  readonly roles = computed(() => this.usersService.getRoles());
  readonly totalMiembros = computed(() => this.usersService.members().length);

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
  }

  ngOnDestroy(): void {
    this.invitationsSub?.unsubscribe();
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
      const token = await this.invitationService.createInvitation(
        company.id,
        company.name,
        data.email,
        data.role,
        createdBy,
      );
      const link = `${window.location.origin}/invite?token=${token}`;
      this.inviteLink.set(link);
    } finally {
      this.inviteSaving.set(false);
    }
  }

  async cancelInvitation(id: string): Promise<void> {
    this.cancellingId.set(id);
    try {
      await this.invitationService.cancelInvitation(id);
    } finally {
      this.cancellingId.set(null);
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

  tienePermiso(modulo: string, rol: string): boolean {
    return this.permisosMatriz[modulo]?.[rol] ?? false;
  }
}
