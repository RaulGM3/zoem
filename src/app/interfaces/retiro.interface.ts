import { Timestamp } from '@angular/fire/firestore';

export interface Retiro {
  id: string;
  companyId: string;
  concepto: string;
  importe: number;
  fecha: string;
  cuentaId?: string;
  notas?: string;
  createdBy: string;
  createdAt: Timestamp;
}
