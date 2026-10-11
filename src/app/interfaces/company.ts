import { Timestamp } from '@angular/fire/firestore';
import type { CompanyLogo, CompanyVerifactu } from '../core/services/company.service';
import type { PlanId, Suscripcion } from '../core/planes/catalogo';
import type { CodigoPais } from '../core/paises/catalogo-paises';
import type { UbicacionEmpresa } from '../core/services/company.service';

export type { CompanyVerifactu, UbicacionEmpresa };

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
  /** País del despacho. Empresas anteriores al backfill: sin valor (se lee como ES, ver `paisDeEmpresa`). */
  pais: CodigoPais;
  /** Moneda ISO 4217 del despacho. Fija desde el alta; solo el superusuario la cambia. */
  moneda: string;
  /** Comunidad autónoma: SOLO en España. */
  ca?: ComunidadAutonoma;
  /** División del país (ISO 3166-2, p. ej. `CO-ANT`): SOLO fuera de España. */
  region?: string;
  rubro: Rubro;
  email: string;
  telefono: string;
  direccion: string;
  codigoPostal: string;
  ciudad?: string;
  /** Place ID y coordenadas de la ciudad elegida con Google Places. */
  ubicacion?: UbicacionEmpresa | null;
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
