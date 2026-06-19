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
