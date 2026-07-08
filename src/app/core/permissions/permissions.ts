import { FirmRole } from '../../interfaces/member';

/**
 * Lógica PURA de permisos — sin Angular, sin signals, sin DI.
 * Es la única fuente de verdad de qué puede hacer cada rol.
 * `PermissionService` la envuelve con signals; los tests la prueban sin TestBed.
 */

export type Capability = 'ver' | 'crear' | 'editar' | 'eliminar';

export type Modulo =
  | 'Casos'
  | 'Contactos'
  | 'Calendario'
  | 'Documentos'
  | 'Facturación'
  | 'Tesorería'
  | 'RecepciónIA'
  | 'Informes'
  | 'Configuración';

export const MODULOS: Modulo[] = [
  'Casos',
  'Contactos',
  'Calendario',
  'Documentos',
  'Facturación',
  'Tesorería',
  'RecepciónIA',
  'Informes',
  'Configuración',
];

export const CAPABILITIES: Capability[] = ['ver', 'crear', 'editar', 'eliminar'];

export type RoleCaps = Record<Capability, boolean>;

/** Helpers para leer la matriz de un vistazo. */
const ALL: RoleCaps = { ver: true, crear: true, editar: true, eliminar: true };
const VER: RoleCaps = { ver: true, crear: false, editar: false, eliminar: false };
const NADA: RoleCaps = { ver: false, crear: false, editar: false, eliminar: false };
const caps = (ver: boolean, crear: boolean, editar: boolean, eliminar: boolean): RoleCaps => ({
  ver,
  crear,
  editar,
  eliminar,
});

/**
 * Matriz de capacidades por módulo y rol. Admin = control total en todo.
 * Editar acá es el único lugar para cambiar qué puede hacer cada rol.
 */
export const PERMISOS: Record<Modulo, Record<FirmRole, RoleCaps>> = {
  Casos: {
    Admin: ALL,
    Gestor: ALL,
    Usuario: caps(true, true, true, false),
    Viewer: VER,
  },
  Contactos: {
    Admin: ALL,
    Gestor: ALL,
    Usuario: caps(true, true, true, false),
    Viewer: VER,
  },
  Calendario: {
    Admin: ALL,
    Gestor: ALL,
    Usuario: caps(true, true, true, false),
    Viewer: VER,
  },
  Documentos: {
    Admin: ALL,
    Gestor: ALL,
    Usuario: caps(true, true, true, false),
    Viewer: VER,
  },
  Facturación: {
    Admin: ALL,
    Gestor: caps(true, true, true, false),
    Usuario: NADA,
    Viewer: VER,
  },
  Tesorería: {
    Admin: ALL,
    Gestor: caps(true, true, true, false),
    Usuario: NADA,
    Viewer: NADA,
  },
  RecepciónIA: {
    Admin: ALL,
    Gestor: ALL,
    Usuario: caps(true, true, true, false),
    Viewer: VER,
  },
  Informes: {
    Admin: ALL,
    Gestor: VER,
    Usuario: NADA,
    Viewer: VER,
  },
  Configuración: {
    Admin: ALL,
    Gestor: NADA,
    Usuario: NADA,
    Viewer: NADA,
  },
};

/**
 * ¿Puede `role` ejecutar `cap` en `modulo`?
 * El superusuario pasa por encima de todo. El resto lee la matriz (sin atajos para Admin:
 * la matriz es la fuente de verdad, así el tab "Permisos" y el comportamiento nunca divergen).
 */
export function can(
  role: FirmRole | null,
  isSuperUser: boolean,
  modulo: Modulo,
  cap: Capability,
): boolean {
  if (isSuperUser) return true;
  if (!role) return false;
  return PERMISOS[modulo]?.[role]?.[cap] ?? false;
}

/** Roles cuya fila es configurable por la empresa. Admin nunca se toca. */
export type ConfigurableRole = Exclude<FirmRole, 'Admin'>;
export const FIRM_ROLES_MATRIZ: ConfigurableRole[] = ['Gestor', 'Usuario', 'Viewer'];

/**
 * Matriz de empresa SPARSE: solo las celdas que difieren de `PERMISOS`.
 * Doc ausente / mapa vacío = comportamiento por defecto. Admin no es configurable.
 */
export type MatrixOverride = Partial<
  Record<Modulo, Partial<Record<ConfigurableRole, Partial<RoleCaps>>>>
>;

/** Overrides por usuario: true concede, false revoca, ausente hereda empresa → base. */
export type UserPermissionOverrides = Partial<Record<Modulo, Partial<Record<Capability, boolean>>>>;

/**
 * Matriz SPARSE de un rol custom: deltas sobre su rol base.
 * Un rol custom NO existe para las security rules — el member guarda su
 * `baseRole` en `role` (enforcement grueso gratis) y el nombre/matriz custom
 * solo refinan en cliente, igual que la matriz de empresa.
 */
export type CustomRoleMatrix = Partial<Record<Modulo, Partial<RoleCaps>>>;

/** Definición de un rol creado por la empresa. Vive en `settings/roles`. */
export interface CustomRoleDef {
  id: string;
  nombre: string;
  descripcion?: string;
  /** Rol de las security rules al que se ancla. Nunca Admin. */
  baseRole: ConfigurableRole;
  matrix: CustomRoleMatrix;
}

/**
 * Como `can()`, pero resolviendo la cadena completa de configuración:
 * override de usuario > matriz del rol custom > matriz de empresa > matriz base.
 * Admin ignora todos los niveles (siempre resuelve contra la base = control total).
 */
export function resolveCan(
  role: FirmRole | null,
  isSuperUser: boolean,
  modulo: Modulo,
  cap: Capability,
  companyMatrix?: MatrixOverride,
  userOverrides?: UserPermissionOverrides,
  customRoleMatrix?: CustomRoleMatrix,
): boolean {
  if (isSuperUser) return true;
  if (!role) return false;
  if (role !== 'Admin') {
    const user = userOverrides?.[modulo]?.[cap];
    if (user !== undefined) return user;
    const custom = customRoleMatrix?.[modulo]?.[cap];
    if (custom !== undefined) return custom;
    const company = companyMatrix?.[modulo]?.[role]?.[cap];
    if (company !== undefined) return company;
  }
  return PERMISOS[modulo]?.[role]?.[cap] ?? false;
}

/** Matriz efectiva de un rol custom (base del rol base + empresa + custom). Para la UI. */
export function customRoleCaps(
  baseRole: ConfigurableRole,
  customMatrix: CustomRoleMatrix,
  companyMatrix?: MatrixOverride,
): Record<Modulo, RoleCaps> {
  const result = {} as Record<Modulo, RoleCaps>;
  for (const modulo of MODULOS) {
    result[modulo] = {
      ...PERMISOS[modulo][baseRole],
      ...companyMatrix?.[modulo]?.[baseRole],
      ...customMatrix[modulo],
    };
  }
  return result;
}

/** Matriz base + deltas de empresa fusionadas. Para renderizar el tab "Permisos". */
export function effectiveMatrix(
  companyMatrix?: MatrixOverride,
): Record<Modulo, Record<FirmRole, RoleCaps>> {
  const result = {} as Record<Modulo, Record<FirmRole, RoleCaps>>;
  for (const modulo of MODULOS) {
    result[modulo] = { ...PERMISOS[modulo] };
    for (const role of FIRM_ROLES_MATRIZ) {
      const delta = companyMatrix?.[modulo]?.[role];
      result[modulo][role] = { ...PERMISOS[modulo][role], ...delta };
    }
  }
  return result;
}

/**
 * ¿Puede el editor de la matriz CONCEDER esta celda? Las security rules
 * mantienen un envelope grueso (Viewer nunca escribe, finanzas solo
 * Admin/Gestor, gestión de miembros solo Admin); conceder fuera del envelope
 * sería mentirle al usuario: el cliente lo mostraría pero el servidor lo
 * rechazaría. Revocar siempre es válido.
 */
export function isCellGrantable(modulo: Modulo, role: ConfigurableRole, cap: Capability): boolean {
  if (cap === 'ver') return true;
  if (role === 'Viewer') return false;
  if (modulo === 'Configuración') return false;
  if ((modulo === 'Facturación' || modulo === 'Tesorería') && role === 'Usuario') return false;
  return true;
}

/** Delta sparse entre la matriz editada y la base. Admin se ignora siempre. */
export function diffMatrix(edited: Record<Modulo, Record<FirmRole, RoleCaps>>): MatrixOverride {
  const delta: MatrixOverride = {};
  for (const modulo of MODULOS) {
    for (const role of FIRM_ROLES_MATRIZ) {
      for (const cap of CAPABILITIES) {
        const value = edited[modulo]?.[role]?.[cap];
        if (value !== undefined && value !== PERMISOS[modulo][role][cap]) {
          ((delta[modulo] ??= {})[role] ??= {})[cap] = value;
        }
      }
    }
  }
  return delta;
}
