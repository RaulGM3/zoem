import { Timestamp } from '@angular/fire/firestore';

export type MovimientoTipo = 'ingreso' | 'suplido' | 'honorario' | 'gasto' | 'otro';

export interface MovimientoGestoria {
  id: string;
  casoId: string;
  companyId: string;
  tipo: MovimientoTipo;
  concepto: string;
  importe: number;
  esEntrada: boolean;
  fecha: string;
  notas?: string;
  createdBy: string;
  createdAt: Timestamp;
  aprobado?: boolean;
  aprobadoAt?: Timestamp;
  aprobadoPor?: string;
  cuentaId?: string;
}
