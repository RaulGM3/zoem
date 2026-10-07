import type { DiaRojo } from './dias-rojos';
import { diaSemana, sumarDias } from './fechas-iso';

export type Jurisdiccion = 'civil' | 'penal' | 'contencioso' | 'laboral';
export const JURISDICCIONES: readonly Jurisdiccion[] = ['civil', 'penal', 'contencioso', 'laboral'];
export const JURISDICCION_LABEL: Record<Jurisdiccion, string> = {
  civil: 'Civil',
  penal: 'Penal',
  contencioso: 'Contencioso-administrativo',
  laboral: 'Laboral',
};
export type MotivoInhabil = 'sabado' | 'domingo' | 'agosto' | 'navidad' | 'festivo';

export interface DiaInhabil {
  fecha: string;
  motivo: MotivoInhabil;
  etiqueta: string;
}

export interface ContextoCalendario {
  jurisdiccion: Jurisdiccion;
  /** Actuaciones urgentes: agosto cuenta como hábil. */
  urgente?: boolean;
  /** Solo días rojos confirmados (ver `componerDiasRojos`). */
  diasRojos: ReadonlyMap<string, DiaRojo>;
  /** Fechas que el usuario desmarcó en la revisión: se tratan como hábiles. */
  excluidos?: readonly string[];
}

/** Jurisdicciones para las que agosto es inhábil (el orden penal sí actúa en agosto). */
const AGOSTO_INHABIL: readonly Jurisdiccion[] = ['civil', 'contencioso', 'laboral'];

/** true si agosto no computa para `fecha` en este contexto (jurisdicción, urgencia y exclusiones del usuario). */
export function agostoNoComputa(fecha: string, ctx: ContextoCalendario): boolean {
  return fecha.slice(5, 7) === '08' && !ctx.urgente && AGOSTO_INHABIL.includes(ctx.jurisdiccion) && !ctx.excluidos?.includes(fecha);
}

/** Devuelve por qué `fecha` es inhábil, o null si es hábil. */
export function motivoInhabil(fecha: string, ctx: ContextoCalendario): DiaInhabil | null {
  if (ctx.excluidos?.includes(fecha)) return null;
  const dia = diaSemana(fecha);
  if (dia === 6) return { fecha, motivo: 'sabado', etiqueta: 'Sábado' };
  if (dia === 0) return { fecha, motivo: 'domingo', etiqueta: 'Domingo' };
  const rojo = ctx.diasRojos.get(fecha);
  if (rojo) return { fecha, motivo: 'festivo', etiqueta: rojo.nombre };
  const [, mes, d] = fecha.split('-');
  if (mes === '12' && (d === '24' || d === '31')) return { fecha, motivo: 'navidad', etiqueta: `${Number(d)} de diciembre` };
  if (mes === '08' && !ctx.urgente && AGOSTO_INHABIL.includes(ctx.jurisdiccion)) {
    return { fecha, motivo: 'agosto', etiqueta: 'Agosto inhábil' };
  }
  return null;
}

/** Primer día hábil estrictamente posterior a `fecha`. */
export function siguienteHabil(fecha: string, ctx: ContextoCalendario): string {
  let cur = sumarDias(fecha, 1);
  while (motivoInhabil(cur, ctx)) cur = sumarDias(cur, 1);
  return cur;
}

/** Avanza `n` días hábiles desde `fecha` (sin contarla). */
export function sumarDiasHabiles(fecha: string, n: number, ctx: ContextoCalendario): string {
  let cur = fecha;
  for (let i = 0; i < n; i++) cur = siguienteHabil(cur, ctx);
  return cur;
}
