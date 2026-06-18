import { Timestamp } from '@angular/fire/firestore';

export type CuentaTipo = 'banco' | 'caja';

export interface CuentaBancaria {
  id: string;
  companyId: string;
  nombre: string;
  tipo: CuentaTipo;
  entidad?: string;
  iban?: string;
  saldoBancario?: number;
  saldoBancarioFecha?: string;
  activa: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
