import { Timestamp } from '@angular/fire/firestore';

export type ContactType = 'persona_fisica' | 'persona_juridica';
export type ContactStatus =
  | 'potencial'
  | 'activo'
  | 'inactivo'
  | 'cerrado_finalizado'
  | 'pendiente_presupuesto'
  | 'pendiente_firma_hoja_encargo'
  | 'pendiente_pago'
  | 'integracion_plantillas';

export type CanalEntrada =
  | 'email'
  | 'telefono'
  | 'referido'
  | 'web'
  | 'presencial'
  | 'redes_sociales'
  | 'otro';

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  potencial: 'Potencial',
  activo: 'Activo',
  inactivo: 'Inactivo',
  cerrado_finalizado: 'Cerrado / Finalizado',
  pendiente_presupuesto: 'Pendiente de presupuesto',
  pendiente_firma_hoja_encargo: 'Pendiente de firma de hoja de encargo',
  pendiente_pago: 'Pendiente de pago',
  integracion_plantillas: 'Integración plantillas de casos',
};

export const CANAL_ENTRADA_LABELS: Record<CanalEntrada, string> = {
  email: 'Email',
  telefono: 'Teléfono',
  referido: 'Referido',
  web: 'Web / Online',
  presencial: 'Presencial',
  redes_sociales: 'Redes Sociales',
  otro: 'Otro',
};

export interface Direccion {
  calle?: string;
  numero?: string;
  piso?: string;
  codigoPostal?: string;
  municipio?: string;
  provincia?: string;
  pais: string; // ISO 3166-1 alpha-2
}

interface ContactBase {
  id: string;
  companyId: string;
  type: ContactType;
  email: string;
  phone?: string;
  mobile?: string;
  status: ContactStatus;
  assignedTo?: string;
  asunto?: string;
  canalEntrada?: CanalEntrada;
  tags?: string[];
  notes?: string;
  language?: string; // ISO 639-1
  activeProjects?: number;
  totalBilled?: number;
  lastContact?: Timestamp | string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PersonaFisica extends ContactBase {
  type: 'persona_fisica';
  nombre: string;
  apellidos: string;
  nifType: 'dni' | 'nie' | 'pasaporte' | 'otro';
  nif?: string;
  lugarNacimiento?: string;
  nacionalidad?: string; // ISO 3166-1 alpha-2
  estadoCivil?: 'soltero' | 'casado' | 'divorciado' | 'viudo' | 'pareja_hecho';
  profesion?: string;
  direccion?: Direccion;
}

export interface PersonaJuridica extends ContactBase {
  type: 'persona_juridica';
  razonSocial: string;
  nombreComercial?: string;
  formaJuridica?: string; // S.L., S.A., Cooperativa, etc.
  cifType: 'cif' | 'vat' | 'otro';
  cif?: string; // CIF España / VAT UE / Tax ID internacional
  fechaConstitucion?: string;
  registroMercantil?: string;
  sectorActividad?: string;
  website?: string;
  direccionSocial?: Direccion;
  direccionFiscal?: Direccion;
  representanteLegalNombre?: string;
  representanteLegalId?: string; // FK a PersonaFisica si existe
}

export type Contact = PersonaFisica | PersonaJuridica;

export function getContactDisplayName(c: Contact): string {
  return c.type === 'persona_fisica' ? `${c.nombre} ${c.apellidos}` : c.razonSocial;
}

export function getContactInitials(c: Contact): string {
  const name = getContactDisplayName(c);
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
