import type { PlanId } from './catalogo';
import { esEmpresaDemo } from './demo';

interface MembresiaMinima {
  companyId: string;
  company?: { name?: string; esDemo?: boolean; suscripcion?: { plan: PlanId } } | null;
}

/** Primer despacho REAL (no demo) del usuario distinto del activo, para el botón "Ir a mi despacho". */
export function despachoRealAlternativo(
  membresias: readonly MembresiaMinima[],
  activoId: string | undefined,
): { id: string; nombre: string } | null {
  const m = membresias.find((x) => x.companyId !== activoId && !esEmpresaDemo(x.company));
  return m ? { id: m.companyId, nombre: m.company?.name ?? m.companyId } : null;
}
