export type Claims = Record<string, unknown>;

interface MemberData {
  role?: unknown;
  estado?: unknown;
}

/**
 * Claims de membresía (companyId/role/estado) para `cid`, preservando el
 * resto (p. ej. isSuperUser). `member` null → miembro eliminado: se limpian.
 */
export function claimsDeMiembro(existing: Claims, cid: string, member: MemberData | null): Claims {
  if (!member) return { ...existing, companyId: null, role: null, estado: null };
  return {
    ...existing,
    companyId: cid,
    role: member.role ?? null,
    estado: member.estado ?? null,
  };
}

/** true si difiere algún claim de membresía que leen las Storage rules. */
export function claimsCambian(antes: Claims, despues: Claims): boolean {
  return (['companyId', 'role', 'estado'] as const).some((k) => (antes[k] ?? null) !== (despues[k] ?? null));
}
