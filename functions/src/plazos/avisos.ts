import { siguienteHabil, motivoInhabil } from './dominio/calendario-judicial';
import type { ContextoCalendario } from './dominio/calendario-judicial';
import type { DiaRojo } from './dominio/dias-rojos';
import { sumarDias } from './dominio/fechas-iso';
import { formatearFechaEs } from './revision';
import type { PlazoDoc } from './tipos';

/** Días hábiles restantes en los que se avisa. */
export const DIAS_DE_AVISO: readonly number[] = [5, 2, 0];

export interface AvisoPlazo {
  plazo: PlazoDoc;
  diasHabiles: number;
  /** Valor para `origen.ultimoAviso`: 'YYYY-MM-DD:N'. */
  marca: string;
}

/** Fecha de hoy (YYYY-MM-DD) en Europe/Madrid. */
export const hoyMadrid = (ahora: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);

/** Días hábiles en (hoy, vencimiento]. 0 si es hoy; negativo si ya pasó. */
export function diasHabilesRestantes(hoy: string, vencimiento: string, ctx: ContextoCalendario): number {
  if (hoy === vencimiento) return 0;
  if (hoy > vencimiento) return -diasHabilesRestantes(vencimiento, hoy, ctx);
  let n = 0;
  for (let d = sumarDias(hoy, 1); d <= vencimiento; d = sumarDias(d, 1)) {
    if (!motivoInhabil(d, ctx)) n++;
  }
  return n;
}

/** Compone los días rojos de las capas del plazo (el partido gana). Capas ausentes = sin festivos. */
function diasRojosDelPlazo(plazo: PlazoDoc, porCapa: ReadonlyMap<string, ReadonlyMap<string, DiaRojo>>): Map<string, DiaRojo> {
  const compuesto = new Map<string, DiaRojo>();
  for (const capaId of [plazo.origen.capas.ca, plazo.origen.capas.partido]) {
    for (const [fecha, dia] of porCapa.get(capaId ?? '') ?? []) compuesto.set(fecha, dia);
  }
  return compuesto;
}

/** Si la revisión pendiente adelanta el vencimiento, se avisa con el más cercano (lado seguro). */
function vencimientoEfectivo(plazo: PlazoDoc): string {
  const { aceptacion, revision, estadoPlazo } = plazo.origen;
  return estadoPlazo === 'requiere_revision' && revision?.seAdelanta && revision.vencimientoNuevo < aceptacion.vencimiento
    ? revision.vencimientoNuevo
    : aceptacion.vencimiento;
}

/**
 * Decide qué plazos avisar hoy (5, 2 o 0 días hábiles) y cuáles marcar `vencido` (hoy > día de gracia).
 * `diasRojosPorCapa`: capaId -> fecha -> día rojo confirmado (todos los años cargados).
 */
export function seleccionarAvisos(
  plazos: readonly PlazoDoc[],
  hoyIso: string,
  diasRojosPorCapa: ReadonlyMap<string, ReadonlyMap<string, DiaRojo>>,
): { avisos: AvisoPlazo[]; vencidos: PlazoDoc[] } {
  const avisos: AvisoPlazo[] = [];
  const vencidos: PlazoDoc[] = [];
  for (const plazo of plazos) {
    const { estadoPlazo, entrada, aceptacion } = plazo.origen;
    if (estadoPlazo !== 'vigente' && estadoPlazo !== 'requiere_revision') continue;
    const ctx: ContextoCalendario = {
      jurisdiccion: entrada.jurisdiccion,
      urgente: entrada.urgente,
      diasRojos: diasRojosDelPlazo(plazo, diasRojosPorCapa),
      excluidos: aceptacion.excluidosPorUsuario,
    };

    if (estadoPlazo === 'vigente' && hoyIso > siguienteHabil(aceptacion.vencimiento, ctx)) {
      vencidos.push(plazo);
      continue;
    }

    const restantes = diasHabilesRestantes(hoyIso, vencimientoEfectivo(plazo), ctx);
    if (!DIAS_DE_AVISO.includes(restantes)) continue;
    const marca = `${hoyIso}:${restantes}`;
    if (plazo.origen.ultimoAviso === marca) continue;
    avisos.push({ plazo, diasHabiles: restantes, marca });
  }
  return { avisos, vencidos };
}

export function textoAviso(plazo: PlazoDoc, diasHabiles: number): { titulo: string; cuerpo: string } {
  const nombre = plazo.titulo.replace(/^Vence plazo:\s*/, '');
  const vence = formatearFechaEs(vencimientoEfectivo(plazo));
  if (diasHabiles === 0) {
    return {
      titulo: `Hoy vence el plazo «${nombre}»`,
      cuerpo: `Vence hoy (${vence}). Día de gracia (art. 135 LEC): hasta las 15:00 del siguiente día hábil. Cálculo orientativo (BETA).`,
    };
  }
  return {
    titulo: `El plazo «${nombre}» vence en ${diasHabiles} días hábiles (${vence})`,
    cuerpo: 'Cálculo orientativo (BETA): verifica el vencimiento en el detalle del caso.',
  };
}
