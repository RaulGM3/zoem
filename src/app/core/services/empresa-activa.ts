/** localStorage: despacho que el usuario eligió en el selector (solo conveniencia por navegador). */
export const CLAVE_EMPRESA_ACTIVA = 'zoem.empresa.activa';

/** Empresa a activar al iniciar sesión: la elegida por el usuario si sigue siendo suya; si no, la primera. */
export function elegirEmpresaInicial(
  membresias: readonly { companyId: string }[],
  guardada: string | null,
): string | null {
  if (membresias.length === 0) return null;
  const elegida = membresias.find((m) => m.companyId === guardada);
  return (elegida ?? membresias[0]).companyId;
}
