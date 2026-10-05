import type { Hito } from '../../interfaces/caso.interface';

type HitoMin = Pick<Hito, 'id' | 'orden' | 'estado'>;

/**
 * Hito por defecto al ejecutar una acción desde un caso: el último completado
 * (por `orden`) — "lo que acabamos de terminar"; si no hay ninguno, el primero
 * aún abierto (pendiente / en progreso). Los cancelados nunca se sugieren.
 */
export function hitoSugerido<T extends HitoMin>(hitos: readonly T[]): T | null {
  const ordenados = [...hitos].sort((a, b) => a.orden - b.orden);
  const completados = ordenados.filter((h) => h.estado === 'completado');
  if (completados.length) return completados[completados.length - 1];
  return ordenados.find((h) => h.estado !== 'cancelado') ?? null;
}
