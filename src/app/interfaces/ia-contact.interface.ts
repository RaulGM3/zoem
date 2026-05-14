export interface IaContact {
  id: string;
  tipo: 'llamada' | 'whatsapp' | 'email';
  fecha: string;
  hora: string;
  cliente: {
    nombre: string;
    telefono: string;
    email: string;
    empresa: string | null;
  };
  categoria: string;
  descripcion: string;
  urgencia: 'baja' | 'normal' | 'alta' | 'urgente';
  puntuacion: number;
  estado: 'pendiente' | 'en_proceso' | 'resuelto' | 'descartado';
  duracion?: string;
}
