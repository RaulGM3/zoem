import { Timestamp } from '@angular/fire/firestore';
import type { CuentaTipo } from './cuenta-bancaria.interface';

export interface CierreCuenta {
  cuentaId: string;
  nombre: string;
  tipo: CuentaTipo;
  ingresos: number;
  egresos: number;
  sistema: number;
  aprobado: number;
  saldoReal: number | null;
  diferencia: number | null;
  conciliado: boolean;
}

export interface CierreCaja {
  id: string;
  fecha: string;
  companyId: string;
  creadoPor: string;
  creadoAt: Timestamp;
  notas?: string;
  cuentas: CierreCuenta[];
  totales: {
    ingresos: number;
    egresos: number;
    sistemaTotal: number;
    aprobadoTotal: number;
  };
}
