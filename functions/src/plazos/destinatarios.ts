/**
 * Quién debe recibir avisos de plazos procesales: miembros activos que pueden ver el módulo 'Casos'.
 * Espejo SERVER-SIDE de `resolveCan(role, false, 'Casos', 'ver', ...)` en src/app/core/permissions/permissions.ts
 * (cadena: override del miembro > rol custom > matriz de empresa > matriz base; Admin ignora los tres primeros).
 * No contempla superusuarios: no son miembros de la empresa, así que no reciben avisos de despacho.
 */

type CapsVer = { ver?: boolean };

export interface MiembroPermisos {
  id: string;
  role?: string;
  estado?: string;
  customRoleId?: string | null;
  permissionOverrides?: { Casos?: CapsVer };
}

export interface ConfigPermisosCasos {
  /** `companies/{cid}/settings/permissions`.matrix (dispersa: solo deltas). */
  matrizEmpresa?: { Casos?: Partial<Record<string, CapsVer>> };
  /** `companies/{cid}/settings/roles`.roles. */
  rolesCustom?: { id: string; matrix?: { Casos?: CapsVer } }[];
}

/** Matriz base de `Casos.ver` (ver `PERMISOS.Casos` en la app; hay un spec que vigila que no diverja). */
const BASE_CASOS_VER: Readonly<Record<string, boolean>> = { Admin: true, Gestor: true, Usuario: true, Viewer: true };

export function puedeVerCasos(miembro: MiembroPermisos, cfg: ConfigPermisosCasos): boolean {
  const role = miembro.role;
  if (!role || !(role in BASE_CASOS_VER)) return false;
  if (role !== 'Admin') {
    const propio = miembro.permissionOverrides?.Casos?.ver;
    if (propio !== undefined) return propio;
    const custom = miembro.customRoleId
      ? cfg.rolesCustom?.find((r) => r.id === miembro.customRoleId)?.matrix?.Casos?.ver
      : undefined;
    if (custom !== undefined) return custom;
    const empresa = cfg.matrizEmpresa?.Casos?.[role]?.ver;
    if (empresa !== undefined) return empresa;
  }
  return BASE_CASOS_VER[role];
}

export function destinatariosCasos(miembros: readonly MiembroPermisos[], cfg: ConfigPermisosCasos): string[] {
  return miembros.filter((m) => m.estado === 'activo' && puedeVerCasos(m, cfg)).map((m) => m.id);
}

/** Forma mínima de Firestore para el cargador (fake en tests si hiciera falta). */
export interface DbLectura {
  doc(path: string): { get(): Promise<{ exists: boolean; data(): unknown }> };
  collection(path: string): {
    where(campo: string, op: '==', valor: unknown): { get(): Promise<{ docs: ReadonlyArray<{ id: string; data(): unknown }> }> };
  };
}

/** Carga miembros activos + configuración de permisos de la empresa y resuelve los destinatarios. */
export async function cargarDestinatariosCasos(db: DbLectura, cid: string): Promise<string[]> {
  const [miembrosSnap, permisosSnap, rolesSnap] = await Promise.all([
    db.collection(`companies/${cid}/members`).where('estado', '==', 'activo').get(),
    db.doc(`companies/${cid}/settings/permissions`).get(),
    db.doc(`companies/${cid}/settings/roles`).get(),
  ]);
  const permisos = permisosSnap.exists ? (permisosSnap.data() as { matrix?: ConfigPermisosCasos['matrizEmpresa'] } | undefined) : undefined;
  const roles = rolesSnap.exists ? (rolesSnap.data() as { roles?: ConfigPermisosCasos['rolesCustom'] } | undefined) : undefined;
  const miembros = miembrosSnap.docs.map((d) => ({ ...(d.data() as Omit<MiembroPermisos, 'id'>), id: d.id }));
  return destinatariosCasos(miembros, { matrizEmpresa: permisos?.matrix, rolesCustom: roles?.roles });
}
