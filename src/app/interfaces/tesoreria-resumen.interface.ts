import { Timestamp } from '@angular/fire/firestore';

export interface TesoreriaResumen {
  totalIngresosCerrados: number;
  totalSuplidosCerrados: number;
  totalHonorariosCerrados: number;
  totalEgresosCerrados: number;
  saldoCerrados: number;
  casosCount: number;
  ultimaActualizacion: Timestamp;
}
