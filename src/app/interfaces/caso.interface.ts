export interface Caso {
  id: string;
  cliente: string;
  tipo: 'Legal' | 'Fiscal' | 'Laboral' | 'Mercantil' | 'Civil';
  estado: 'pendiente' | 'en_proceso' | 'cerrado' | 'urgente';
  prioridad: 'alta' | 'media' | 'baja';
  asignado: string;
  vencimiento: string;
  diasVencimiento: number;
  descripcion: string;
}
