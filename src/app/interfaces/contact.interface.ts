export interface Contact {
  id: string;
  name: string;
  type: 'Persona' | 'Empresa' | 'Autónomo';
  email: string;
  phone: string;
  status: 'Activo' | 'Inactivo' | 'Potencial';
  activeProjects: number;
  totalBilled: number;
  lastContact: string;
  address?: string;
  nif?: string;
  tags?: string[];
  industry?: string;
}
