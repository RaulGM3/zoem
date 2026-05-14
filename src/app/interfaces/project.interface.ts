export interface Project {
  id: string;
  client: string;
  type: string;
  status: 'En curso' | 'Pendiente' | 'En espera' | 'Completado' | 'Archivado';
  description: string;
  openDate: string;
  lastUpdate: string;
  nextDeadline?: string;
  daysToDeadline?: number;
  assignedTo: string;
  priority: 'alta' | 'media' | 'baja';
  progress: number;
  budget?: number;
  hoursLogged?: number;
}
