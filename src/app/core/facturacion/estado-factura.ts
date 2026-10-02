import type { InvoiceStatus } from '../services/invoice.service';

/** Etiqueta y colores de la píldora de estado de una factura (mismo aspecto en todas las vistas). */
const ESTADO_FACTURA: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  borrador:  { label: 'Borrador',  bg: 'color-mix(in srgb,var(--text-faint) 12%,transparent)', color: 'var(--text-muted)' },
  pendiente: { label: 'Pendiente', bg: 'color-mix(in srgb,var(--warning) 12%,transparent)',    color: 'var(--warning)' },
  pagada:    { label: 'Pagada',    bg: 'color-mix(in srgb,var(--success) 12%,transparent)',    color: 'var(--success)' },
  vencida:   { label: 'Vencida',   bg: 'color-mix(in srgb,var(--danger) 12%,transparent)',     color: 'var(--danger)' },
  anulada:   { label: 'Anulada',   bg: 'color-mix(in srgb,var(--text-faint) 12%,transparent)', color: 'var(--text-faint)' },
};

export function estiloEstadoFactura(status: InvoiceStatus): { background: string; color: string } {
  const cfg = ESTADO_FACTURA[status] ?? ESTADO_FACTURA.pendiente;
  return { background: cfg.bg, color: cfg.color };
}

export function etiquetaEstadoFactura(status: InvoiceStatus): string {
  return ESTADO_FACTURA[status]?.label ?? status;
}
