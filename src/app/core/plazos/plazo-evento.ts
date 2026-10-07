import { esPlazoProcesal } from '../../interfaces/evento.interface';
import type { CreateEventoData, Evento, OrigenPlazoProcesal } from '../../interfaces/evento.interface';
import type { EntradaPlazo, ResultadoPlazo } from './computo-plazo';

export type EntradaPlazoGuardada = Pick<EntradaPlazo, 'fechaNotificacion' | 'cantidad' | 'unidad' | 'jurisdiccion' | 'urgente'> & {
  tipoPlazoId?: string;
};

export interface DatosPlazoAceptado {
  casoId: string;
  casoTitulo?: string;
  /** Nombre visible del plazo (p. ej. el del catálogo) para el título del evento. */
  etiqueta: string;
  entrada: EntradaPlazoGuardada;
  capas: { ca: string; partido?: string };
  resultado: ResultadoPlazo;
  excluidosPorUsuario: readonly string[];
  uid: string;
  ahoraIso: string;
  invitados?: CreateEventoData['invitados'];
  documentoId?: string;
}

export const formatearFechaEs = (iso: string): string => iso.split('-').reverse().join('/');

/** Aceptación del cálculo: lo que el usuario revisó y aprobó, congelado en el evento. */
export function construirOrigenPlazo(d: DatosPlazoAceptado): OrigenPlazoProcesal {
  const { fechaNotificacion, cantidad, unidad, jurisdiccion, urgente, tipoPlazoId } = d.entrada;
  return {
    tipo: 'plazo_procesal',
    casoId: d.casoId,
    capas: { ...d.capas },
    entrada: {
      fechaNotificacion, cantidad, unidad, jurisdiccion,
      ...(urgente !== undefined ? { urgente } : {}),
      ...(tipoPlazoId ? { tipoPlazoId } : {}),
    },
    aceptacion: {
      diasInhabiles: d.resultado.diasInhabiles.map(({ fecha, motivo }) => ({ fecha, motivo })),
      excluidosPorUsuario: [...d.excluidosPorUsuario],
      aceptadoPor: d.uid,
      aceptadoAt: d.ahoraIso,
      vencimiento: d.resultado.vencimiento,
    },
    estadoPlazo: 'vigente',
    ...(d.documentoId ? { documentoId: d.documentoId } : {}),
  };
}

export function construirEventoPlazo(d: DatosPlazoAceptado): CreateEventoData {
  return {
    titulo: `Vence plazo: ${d.etiqueta}${d.casoTitulo ? ` · ${d.casoTitulo}` : ''}`,
    descripcion:
      `Plazo procesal calculado por Vertey (BETA, orientativo). Vence el ${formatearFechaEs(d.resultado.vencimiento)}. ` +
      `Día de gracia (art. 135 LEC): ${formatearFechaEs(d.resultado.diaGracia)} hasta las 15:00.`,
    fecha: d.resultado.vencimiento,
    todoDia: true,
    estado: 'confirmado',
    recurrencia: 'ninguna',
    prioridad: 'alta',
    color: 'rojo',
    invitados: d.invitados ?? 'todos',
    origen: construirOrigenPlazo(d),
  };
}

/**
 * Los plazos procesales llevan datos de un caso: solo los ve quien puede leer el módulo 'Casos'
 * (`PermissionService.can('Casos', 'ver')`). Los eventos normales no se ven afectados.
 */
export const puedeVerPlazo = (usuarioPuedeVerCasos: boolean, evento: Evento): boolean =>
  !esPlazoProcesal(evento) || usuarioPuedeVerCasos;
