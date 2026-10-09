// Lógica PURA de la reserva de cupo de IA (el callable `reservarIA` la usa dentro de una transacción).

export const MAX_RESERVA = 5;

export interface ReservaIA {
  companyId: string;
  n: number;
}

export function validarReserva(data: unknown): { ok: true; valor: ReservaIA } | { ok: false } {
  const d = (data ?? {}) as Record<string, unknown>;
  const companyId = d['companyId'];
  const n = d['n'] === undefined ? 1 : d['n'];
  if (typeof companyId !== 'string' || companyId.length === 0 || companyId.length > 128) return { ok: false };
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_RESERVA) return { ok: false };
  return { ok: true, valor: { companyId, n } };
}

export type DecisionReserva =
  | { ok: true; usado: number }
  | { ok: false; usado: number; limite: number };

/** `limite: null` = ilimitado. Si se rechaza, el contador no cambia. */
export function decidirReserva(p: { usado: number; limite: number | null; n: number }): DecisionReserva {
  if (p.limite === null) return { ok: true, usado: p.usado + p.n };
  if (p.usado + p.n > p.limite) return { ok: false, usado: p.usado, limite: p.limite };
  return { ok: true, usado: p.usado + p.n };
}
