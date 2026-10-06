import type { AccionRegistro } from '../../interfaces/accion.interface';

export interface ResumenEjecucion {
  /** Veces que se ejecutó la acción (registros), independientemente de los destinatarios. */
  total: number;
  /** Fecha del envío más reciente; `null` si nunca se envió o el timestamp aún no se resolvió. */
  ultima: Date | null;
  /** Ejecuciones que incluían a cada contacto, en el orden recibido. */
  porContacto: { contactoId: string; total: number }[];
}

/**
 * Resume el log de ejecuciones por acción del catálogo. Un envío a varios
 * contactos cuenta una vez en `total` y una vez para cada destinatario.
 * Los registros de acciones que ya no están en `accionIds` se ignoran.
 */
export function resumirEjecuciones(
  accionIds: readonly string[],
  registros: readonly AccionRegistro[],
  contactoIds: readonly string[],
): Map<string, ResumenEjecucion> {
  const res = new Map<string, ResumenEjecucion>(
    accionIds.map((id) => [id, { total: 0, ultima: null, porContacto: contactoIds.map((c) => ({ contactoId: c, total: 0 })) }]),
  );
  for (const r of registros) {
    const resumen = res.get(r.accionId);
    if (!resumen) continue;
    resumen.total++;
    const fecha = r.createdAt?.toDate() ?? null;
    if (fecha && (!resumen.ultima || fecha > resumen.ultima)) resumen.ultima = fecha;
    for (const pc of resumen.porContacto) {
      if (r.contactoIds.includes(pc.contactoId)) pc.total++;
    }
  }
  return res;
}
