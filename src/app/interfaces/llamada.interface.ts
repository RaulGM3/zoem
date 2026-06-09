import type { Timestamp } from '@angular/fire/firestore';

export interface Turno {
  rol: 'agente' | 'usuario';
  mensaje: string;
}

export type EstadoLlamada = 'completada' | 'fallida' | 'interrumpida';

export interface DatosCapturados {
  nombreCliente?: string;
  telefono?: string;
  especialidadJuridica?: string;
  nivelUrgencia?: string;
  descripcionCaso?: string;
}

export interface LlamadaResumen {
  conversationId: string;
  agentId: string;
  estado: EstadoLlamada;
  duracionSegundos: number;
  resumen: string;
  tituloResumen?: string;
  transcripcion: Turno[];
  exitosa: boolean;
  datosCapturados: DatosCapturados;
  creadoEn: Timestamp;
  descartada?: boolean;
}
