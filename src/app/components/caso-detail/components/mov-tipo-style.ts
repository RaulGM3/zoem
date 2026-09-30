import type { MovimientoTipo } from '../../../interfaces';

/** Colores (fondo atenuado + texto) con los que se pinta cada tipo de movimiento de gestoría. */
export function movTipoStyle(tipo: MovimientoTipo): { background: string; color: string } {
  const mix = (v: string) => `color-mix(in srgb,${v} 12%,transparent)`;
  const map: Record<MovimientoTipo, { background: string; color: string }> = {
    ingreso:   { background: mix('var(--success)'), color: 'var(--success)' },
    suplido:   { background: mix('var(--warning)'), color: 'var(--warning)' },
    honorario: { background: mix('var(--accent-ia)'), color: 'var(--accent-ia)' },
    gasto:     { background: mix('var(--danger)'),  color: 'var(--danger)' },
    otro:      { background: 'var(--surface-2)',     color: 'var(--text-muted)' },
    ajuste:    { background: 'var(--surface-2)',     color: 'var(--text-muted)' },
  };
  return map[tipo];
}
