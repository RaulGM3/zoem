import type { Derechos, Funcion, Limite, Suscripcion } from './catalogo';
import { soloLectura } from './derechos';

/**
 * Clasificador PURO: ¿este error de escritura se debe al plan? Un `permission-denied` solo es ambiguo
 * (rol, cupo, función de pago, demo terminada), así que se decide mirando el estado ya cargado en el
 * cliente (derechos, contadores, demo). Si no es cosa del plan devuelve `null` y el error se muestra como siempre.
 */
export type RecursoBloqueo = Limite | Funcion | 'demo';

export interface MotivoBloqueo {
  tipo: 'cupo' | 'funcion' | 'demoTerminada';
  recurso: RecursoBloqueo;
  usado?: number;
  limite?: number;
}

/** Lo que el llamador sabe de la escritura que ha fallado (qué cupo consume / qué función exige). */
export interface ContextoBloqueo {
  limite?: Limite;
  funcion?: Funcion;
}

export interface EstadoPlanBloqueo {
  derechos: Derechos;
  suscripcion: Suscripcion | null;
}

const CODIGOS_PERMISO = new Set(['permission-denied', 'unauthorized']);

function codigo(error: unknown): string | null {
  const raw = (error as { code?: unknown } | null)?.code;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return raw.slice(raw.lastIndexOf('/') + 1);
}

function cupo(recurso: Limite, derechos: Derechos, uso: (l: Limite) => number): MotivoBloqueo {
  return { tipo: 'cupo', recurso, usado: uso(recurso), limite: derechos.limites[recurso] };
}

export function motivoBloqueoPlan(
  error: unknown,
  contexto: ContextoBloqueo,
  plan: EstadoPlanBloqueo,
  uso: (limite: Limite) => number,
  ahora: Date,
): MotivoBloqueo | null {
  if (!error || typeof error !== 'object') return null;
  const code = codigo(error);

  // Errores propios que ya SON de cupo (no ambiguos).
  if (code === 'cupo-almacenamiento') return cupo('documentosMB', plan.derechos, uso);
  if ((error as { name?: unknown }).name === 'CupoIaAgotadoError') return cupo('iaMensajesMes', plan.derechos, uso);
  if (code === 'resource-exhausted') {
    return contexto.limite === 'iaMensajesMes' ? cupo('iaMensajesMes', plan.derechos, uso) : null;
  }

  if (code === null || !CODIGOS_PERMISO.has(code)) return null;

  if (soloLectura(plan.suscripcion, ahora)) return { tipo: 'demoTerminada', recurso: 'demo' };

  if (contexto.funcion && plan.derechos.funciones[contexto.funcion] !== true) {
    return { tipo: 'funcion', recurso: contexto.funcion };
  }

  if (contexto.limite) {
    const limite = plan.derechos.limites[contexto.limite];
    const usado = uso(contexto.limite);
    if (Number.isFinite(limite) && usado >= limite) return { tipo: 'cupo', recurso: contexto.limite, usado, limite };
  }
  return null;
}
