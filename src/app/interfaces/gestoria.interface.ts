import { Timestamp } from '@angular/fire/firestore';
import type { TipoIva } from './iva';

export type MovimientoTipo = 'ingreso' | 'suplido' | 'honorario' | 'gasto' | 'otro' | 'ajuste';

export interface MovimientoGestoria {
  id: string;
  casoId?: string;
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
  /**
   * Desglose fiscal. `importe` es el total; `baseImponible + cuotaIva === importe`.
   * Movimientos legacy sin estos campos se interpretan como base = importe, cuota = 0.
   */
  tipoIva?: TipoIva;
  ivaExento?: boolean;
  baseImponible?: number;
  cuotaIva?: number;
}
