import { Building2, CalendarX, FileText, Landmark, LucideIconData, Users } from 'lucide-angular';

export type SeccionConfigId = 'empresa' | 'usuarios' | 'facturacion' | 'tesoreria' | 'dias-inhabiles';

export interface SeccionConfig {
  id: SeccionConfigId;
  label: string;
  descripcion: string;
  icon: LucideIconData;
  ruta: string;
}

export const SECCIONES_CONFIG: readonly SeccionConfig[] = [
  { id: 'empresa', label: 'Datos de la empresa', descripcion: 'Razón social, identificación fiscal, contacto y logo', icon: Building2, ruta: '/configuracion/empresa' },
  { id: 'usuarios', label: 'Usuarios y permisos', descripcion: 'Miembros, roles e invitaciones', icon: Users, ruta: '/configuracion/usuarios' },
  { id: 'facturacion', label: 'Facturación', descripcion: 'Verifactu y credenciales AEAT', icon: FileText, ruta: '/configuracion/facturacion' },
  { id: 'tesoreria', label: 'Tesorería', descripcion: 'Cuentas bancarias y cajas', icon: Landmark, ruta: '/configuracion/tesoreria' },
  { id: 'dias-inhabiles', label: 'Días inhábiles', descripcion: 'Festivos que no cuentan en los plazos procesales (BETA)', icon: CalendarX, ruta: '/configuracion/dias-inhabiles' },
];

/** '/configuracion/empresa?x#y' -> 'empresa'; raíz o desconocida -> null. */
export function seccionDesdeUrl(url: string): SeccionConfigId | null {
  const path = url.split(/[?#]/)[0];
  const m = /^\/configuracion\/([^/]+)\/?$/.exec(path);
  if (!m) return null;
  return SECCIONES_CONFIG.find((s) => s.id === m[1])?.id ?? null;
}
