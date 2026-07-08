import { Timestamp } from '@angular/fire/firestore';
import type { UserPermissionOverrides } from '../core/permissions/permissions';

export type FirmRole = 'Admin' | 'Gestor' | 'Usuario' | 'Viewer';
export type MemberEstado = 'activo' | 'inactivo' | 'pendiente';

export const FIRM_ROLES: FirmRole[] = ['Admin', 'Gestor', 'Usuario', 'Viewer'];

export const FIRM_ROLE_COLORS: Record<FirmRole, string> = {
  Admin:   'bg-red-100 text-red-700',
  Gestor:  'bg-violet-100 text-violet-700',
  Usuario: 'bg-blue-100 text-blue-700',
  Viewer:  'bg-slate-100 text-slate-600',
};

export interface FirmRoleConfig {
  id: string;
  nombre: FirmRole;
  descripcion: string;
  usuarios: number;
  color: string;
}

export const FIRM_ROLE_CONFIGS: Omit<FirmRoleConfig, 'usuarios'>[] = [
  { id: 'ROL-001', nombre: 'Admin',   descripcion: 'Acceso total a todos los módulos y configuraciones', color: 'bg-red-100 text-red-700' },
  { id: 'ROL-002', nombre: 'Gestor',  descripcion: 'Gestión de proyectos, clientes y facturación',       color: 'bg-violet-100 text-violet-700' },
  { id: 'ROL-003', nombre: 'Usuario', descripcion: 'Acceso estándar a módulos operativos',               color: 'bg-blue-100 text-blue-700' },
  { id: 'ROL-004', nombre: 'Viewer',  descripcion: 'Solo lectura en todos los módulos',                  color: 'bg-slate-100 text-slate-600' },
];

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  email: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  role: FirmRole;
  departamento: string;
  estado: MemberEstado;
  /** Fee por hora del miembro (opcional). Solo el admin del despacho lo edita. */
  tarifaHoraria?: number;
  /** Excepciones individuales sobre su rol: true concede, false revoca, ausente hereda. */
  permissionOverrides?: UserPermissionOverrides;
  /**
   * Rol custom de la empresa (definido en settings/roles). `role` guarda su
   * rol BASE — lo único que ven las security rules; el custom refina en cliente.
   */
  customRoleId?: string | null;
  ultimoLogin: Timestamp | null;
  createdAt: Timestamp;
}

export function normalizeFirmRole(raw: string): FirmRole {
  if (raw === 'admin' || raw === 'Admin') return 'Admin';
  if (raw === 'Gestor') return 'Gestor';
  if (raw === 'Viewer') return 'Viewer';
  return 'Usuario';
}
