import { componerDiasRojos } from './dominio/dias-rojos';
import type { CapaAnio, DiaRojo } from './dominio/dias-rojos';
import { anioDe } from './dominio/fechas-iso';
import { evaluarRecalculo } from './dominio/recalculo';
import type { OrigenPlazoData } from './tipos';

export type RevisionPlazo = NonNullable<OrigenPlazoData['revision']>;

const clavesConfirmados = (capa?: CapaAnio): Set<string> =>
  new Set((capa?.diasRojos ?? []).filter((d) => d.estado === 'confirmado').map((d) => `${d.fecha}|${d.nombre}`));

/** true si cambió el conjunto de días confirmados (fecha+nombre). Propuestas y marcas de búsqueda no cuentan. */
export function cambioConfirmados(antes?: CapaAnio, despues?: CapaAnio): boolean {
  const a = clavesConfirmados(antes);
  const b = clavesConfirmados(despues);
  return a.size !== b.size || [...a].some((k) => !b.has(k));
}

/**
 * Años cuya capa puede influir en el cómputo: de la notificación al año siguiente al vencimiento aceptado
 * (margen por si el nuevo vencimiento cruza de año). Es conservador: `revisarPlazo` es quien decide si cambia.
 */
export function aniosDelPlazo(origen: OrigenPlazoData): number[] {
  const desde = anioDe(origen.entrada.fechaNotificacion);
  const hasta = anioDe(origen.aceptacion.vencimiento) + 1;
  const anios: number[] = [];
  for (let a = desde; a <= hasta; a++) anios.push(a);
  return anios;
}

export const formatearFechaEs = (iso: string): string => iso.split('-').reverse().join('/');

/**
 * Recalcula un plazo aceptado con los días rojos confirmados actuales de sus capas.
 * Devuelve la revisión a guardar, o null si no cambia / ya estaba marcada igual (idempotente).
 * Nunca modifica nada: el llamante solo escribe `estadoPlazo` y `revision`.
 */
export function revisarPlazo(
  origen: OrigenPlazoData,
  obtenerCapa: (capaId: string, anio: number) => CapaAnio | undefined,
  ahoraIso: string,
): RevisionPlazo | null {
  const diasRojos = new Map<string, DiaRojo>();
  for (const anio of aniosDelPlazo(origen)) {
    const compuestos = componerDiasRojos(
      obtenerCapa(origen.capas.ca, anio),
      origen.capas.partido ? obtenerCapa(origen.capas.partido, anio) : undefined,
    );
    for (const [fecha, dia] of compuestos) diasRojos.set(fecha, dia);
  }
  const { entrada, aceptacion } = origen;
  const r = evaluarRecalculo(
    {
      fechaNotificacion: entrada.fechaNotificacion,
      cantidad: entrada.cantidad,
      unidad: entrada.unidad,
      jurisdiccion: entrada.jurisdiccion,
      urgente: entrada.urgente,
      excluidosPorUsuario: aceptacion.excluidosPorUsuario,
    },
    aceptacion.vencimiento,
    diasRojos,
  );
  if (!r.cambia) return null;
  if (origen.estadoPlazo === 'requiere_revision' && origen.revision?.vencimientoNuevo === r.vencimientoNuevo) return null;
  return { vencimientoNuevo: r.vencimientoNuevo, seAdelanta: r.seAdelanta, detectadoAt: ahoraIso };
}

const nombreDePlazo = (titulo: string): string => titulo.replace(/^Vence plazo:\s*/, '');

export function textoRevision(tituloEvento: string, revision: RevisionPlazo): { titulo: string; cuerpo: string } {
  const nombre = nombreDePlazo(tituloEvento);
  const fecha = formatearFechaEs(revision.vencimientoNuevo);
  if (revision.seAdelanta) {
    return {
      titulo: `⚠ El plazo «${nombre}» ahora vence ANTES: ${fecha}`,
      cuerpo: 'Revisa el cálculo: un cambio en los días inhábiles adelanta el vencimiento.',
    };
  }
  return {
    titulo: `El plazo «${nombre}» requiere revisión`,
    cuerpo: `Un cambio en los días inhábiles modifica el vencimiento (nuevo cálculo: ${fecha}). Revísalo y acéptalo.`,
  };
}
