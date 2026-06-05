import { Component, signal, computed, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import {
  LucideAngularModule, UserCog, Users, Shield, Plus, Search,
  Mail, MoreHorizontal, CheckCircle2, Clock, XCircle,
} from 'lucide-angular';
import { Timestamp } from '@angular/fire/firestore';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import { FIRM_ROLE_COLORS } from '../../interfaces/member';

type UsuariosTab = 'usuarios' | 'roles' | 'permisos';

const ACTIVIDAD = [
  { usuario: 'Carlos Mendoza', accion: 'Inicio de sesión', fecha: 'Hoy, 09:15' },
  { usuario: 'Ana Martínez', accion: 'Creó proyecto 2026-090', fecha: 'Hoy, 08:30' },
  { usuario: 'Laura Sánchez', accion: 'Editó contacto CON-003', fecha: 'Ayer, 17:00' },
  { usuario: 'Pedro García', accion: 'Descargó informe mensual', fecha: 'Ayer, 14:20' },
];

@Component({
  selector: 'app-usuarios',
  imports: [LucideAngularModule],
  templateUrl: './usuarios.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosComponent implements OnInit {
  readonly UserCogIcon = UserCog;
  readonly UsersIcon = Users;
  readonly ShieldIcon = Shield;
  readonly PlusIcon = Plus;
  readonly SearchIcon = Search;
  readonly MailIcon = Mail;
  readonly MoreHorizontalIcon = MoreHorizontal;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly ClockIcon = Clock;
  readonly XCircleIcon = XCircle;

  private readonly usersService = inject(UsersService);
  private readonly permissionService = inject(PermissionService);

  activeTab = signal<UsuariosTab>('usuarios');
  search = signal('');
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
      u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.usersService.loadMembers();
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
