import { Timestamp } from '@angular/fire/firestore';
import type { CompanyLogo, CompanyVerifactu } from '../core/services/company.service';
import type { PlanId, Suscripcion } from '../core/planes/catalogo';

export type { CompanyVerifactu };

export type ComunidadAutonoma =
  | 'andalucia'
  | 'aragon'
  | 'asturias'
  | 'baleares'
  | 'canarias'
  | 'cantabria'
  | 'castilla_la_mancha'
  | 'castilla_y_leon'
  | 'cataluna'
  | 'extremadura'
  | 'galicia'
  | 'la_rioja'
  | 'madrid'
  | 'murcia'
  | 'navarra'
  | 'pais_vasco'
  | 'valencia'
  | 'ceuta'
  | 'melilla';

export type Rubro = 'abogados';

/** Plan comercial visible para el superuser. `demo` solo se crea desde el onboarding. */
export type CompanyPlan = Exclude<PlanId, 'demo'>;

export type CompanyStatus = 'active' | 'inactive' | 'trial';

export type TipoPersona = 'fisica' | 'juridica';

export interface Company {
  id?: string;
  name: string;
  tipoPersona: TipoPersona;
  ca: ComunidadAutonoma;
  rubro: Rubro;
  email: string;
  telefono: string;
  direccion: string;
  codigoPostal: string;
  ciudad: string;
  cif?: string;
  website?: string;
  logo?: CompanyLogo;
  descripcion?: string;
  /** @deprecated Legado. Fuente de verdad: `suscripcion`. */
  plan: CompanyPlan;
  suscripcion?: Suscripcion;
  /** Despacho de ejemplo del autoservicio. */
  esDemo?: boolean;
  /** Creado por el propio usuario (no por el superusuario). */
  autoservicio?: boolean;
  status: CompanyStatus;
  verifactu?: CompanyVerifactu;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy?: string;
}

export const CA_LABELS: Record<ComunidadAutonoma, string> = {
  andalucia: 'Andalucía',
  aragon: 'Aragón',
  asturias: 'Asturias',
  baleares: 'Islas Baleares',
  canarias: 'Canarias',
  cantabria: 'Cantabria',
  castilla_la_mancha: 'Castilla-La Mancha',
  castilla_y_leon: 'Castilla y León',
  cataluna: 'Cataluña',
  extremadura: 'Extremadura',
  galicia: 'Galicia',
  la_rioja: 'La Rioja',
  madrid: 'Comunidad de Madrid',
  murcia: 'Región de Murcia',
  navarra: 'Comunidad Foral de Navarra',
  pais_vasco: 'País Vasco',
  valencia: 'Comunitat Valenciana',
  ceuta: 'Ceuta',
  melilla: 'Melilla',
};

export const RUBRO_LABELS: Record<Rubro, string> = {
  abogados: 'Despacho de Abogados',
};
