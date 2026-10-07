import type { Jurisdiccion } from './dominio/calendario-judicial';
import type { UnidadPlazo } from './dominio/computo-plazo';

/** Subconjunto de `OrigenPlazoProcesal` (src/app/interfaces/evento.interface.ts) que usa el backend. */
export interface OrigenPlazoData {
  casoId: string;
  capas: { ca: string; partido?: string };
  entrada: {
    fechaNotificacion: string;
    cantidad: number;
    unidad: UnidadPlazo;
    jurisdiccion: Jurisdiccion;
    urgente?: boolean;
  };
  aceptacion: { excluidosPorUsuario: string[]; vencimiento: string };
  estadoPlazo: 'vigente' | 'requiere_revision' | 'cumplido' | 'vencido';
  revision?: { vencimientoNuevo: string; seAdelanta: boolean; detectadoAt: string };
  /** 'YYYY-MM-DD:N' — último aviso de vencimiento enviado (evita duplicados el mismo día). */
  ultimoAviso?: string;
}

/** Evento de plazo tal como lo leen las functions. */
export interface PlazoDoc {
  id: string;
  cid: string;
  titulo: string;
  origen: OrigenPlazoData;
}
