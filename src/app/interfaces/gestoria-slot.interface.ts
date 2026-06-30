import { Timestamp } from '@angular/fire/firestore';
import { TipoCosto } from './plantilla.interface';

export type GestoriaSlotTipo = TipoCosto | 'honorarios_base';
export type GestoriaSlotStatus = 'pendiente' | 'registrado';

export interface GestoriaSlot {
  id: string;
  nombre: string;
  tipoCosto: GestoriaSlotTipo;
  importeEstimado?: number;
  ivaIncluido?: boolean;
  status: GestoriaSlotStatus;
  movimientoId?: string;
  importeReal?: number;
  fechaRegistro?: string;
  orden?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
