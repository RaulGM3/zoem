import { Timestamp } from '@angular/fire/firestore';
import { CasoTipo } from './caso.interface';

export interface HitoPlantilla {
  id: string;
  titulo: string;
  descripcion?: string;
  diasDesdeInicio: number;
  asignadoA?: string;
  orden: number;
}

export type TipoCosto =
  | 'suplido'
  | 'cuota_litis'
  | 'intereses_demora'
  | 'costas_judiciales'
  | 'gastos_repercutibles'
  | 'provisiones_fondos'
  | 'saldos_clientes';

export interface PartidaCosto {
  nombre: string;
  tipo: TipoCosto;
  importeEstimado?: number;
  orden?: number;
}

export interface CasoPlantilla {
  id: string;
  companyId: string;
  nombre: string;
  descripcion?: string;
  tipo?: CasoTipo;
  hitos: HitoPlantilla[];
  modeloCostos: {
    honorariosBase?: number;
    suplidos: PartidaCosto[];
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
