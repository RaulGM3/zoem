import { Timestamp } from '@angular/fire/firestore';

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

export type CompanyPlan = 'free' | 'pro' | 'enterprise';

export type CompanyStatus = 'active' | 'inactive' | 'trial';

export type TipoPersona = 'fisica' | 'juridica';

export interface CompanyVerifactu {
  enabled: boolean;
  /** true → prewww1.aeat.es (sandbox AEAT), false → producción real */
  sandbox: boolean;
  certNif?: string;
  certTitular?: string;
  certExpiry?: string;
  certStoredAt?: string;
}

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
  logo?: string;
  descripcion?: string;
  plan: CompanyPlan;
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
