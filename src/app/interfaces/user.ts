export type SystemRole = 'user' | 'admin';

export interface VerteyUserDespacho {
  nombre?: string;
  website?: string;
  direccion?: string;
  ciudad?: string;
  cp?: string;
  pais?: string;
}

export interface VerteyUserProfesional {
  colegio?: string;
  numeroColegiado?: string;
  especialidad?: string;
  anos?: number;
}

export interface VerteyUser {
  id: string;
  email: string;
  displayName: string | null;
  isSuperUser: boolean;
  companyId?: string;
  role?: SystemRole;
  telefono?: string;
  linkedin?: string;
  biografia?: string;
  despacho?: VerteyUserDespacho;
  profesional?: VerteyUserProfesional;
  createdAt?: unknown;
  updatedAt?: unknown;
}
