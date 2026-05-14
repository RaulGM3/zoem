import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import {
  LucideAngularModule, UserCog, Users, Shield, Plus, Search,
  Mail, MoreHorizontal, CheckCircle2, Clock, XCircle,
} from 'lucide-angular';
import { USUARIOS_EMPRESA, ROLES_EMPRESA } from '../../data/dummy-data';

type UsuariosTab = 'usuarios' | 'roles' | 'permisos';

const MODULOS = ['Proyectos', 'Contactos', 'Facturación', 'Tesorería', 'Documentos', 'Informes', 'Configuración'];
const PERMISOS_MATRIZ: Record<string, Record<string, boolean>> = {
  'Proyectos':     { Admin: true,  Gestor: true,  Usuario: true,  Viewer: true  },
  'Contactos':     { Admin: true,  Gestor: true,  Usuario: true,  Viewer: true  },
  'Facturación':   { Admin: true,  Gestor: true,  Usuario: false, Viewer: true  },
  'Tesorería':     { Admin: true,  Gestor: true,  Usuario: false, Viewer: false },
  'Documentos':    { Admin: true,  Gestor: true,  Usuario: true,  Viewer: true  },
  'Informes':      { Admin: true,  Gestor: true,  Usuario: false, Viewer: true  },
  'Configuración': { Admin: true,  Gestor: false, Usuario: false, Viewer: false },
};

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
export class UsuariosComponent {
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

  activeTab = signal<UsuariosTab>('usuarios');
  search = signal('');

  usuarios = USUARIOS_EMPRESA;
  roles = ROLES_EMPRESA;
  modulos = MODULOS;
  permisosMatriz = PERMISOS_MATRIZ;
  actividad = ACTIVIDAD;

  filteredUsuarios = computed(() => {
    const q = this.search().toLowerCase();
    if (!q) return this.usuarios;
    return this.usuarios.filter(u =>
      u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  activos = computed(() => this.usuarios.filter(u => u.estado === 'activo').length);
  pendientes = computed(() => this.usuarios.filter(u => u.estado === 'pendiente').length);

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      activo: 'bg-green-100 text-green-700',
      inactivo: 'bg-slate-100 text-slate-500',
      pendiente: 'bg-amber-100 text-amber-700',
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }

  getRolClass(rol: string): string {
    const map: Record<string, string> = {
      Admin: 'bg-red-100 text-red-700',
      Gestor: 'bg-violet-100 text-violet-700',
      Usuario: 'bg-blue-100 text-blue-700',
      Viewer: 'bg-slate-100 text-slate-600',
    };
    return map[rol] || 'bg-slate-100 text-slate-600';
  }

  tienePermiso(modulo: string, rol: string): boolean {
    return this.permisosMatriz[modulo]?.[rol] ?? false;
  }
}
