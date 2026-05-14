export interface Tarea {
  id: string;
  titulo: string;
  estado: 'completada' | 'en_proceso' | 'pendiente';
}

export interface HistorialEntry {
  id: string;
  fecha: string;
  evento: string;
  usuario: string;
}
