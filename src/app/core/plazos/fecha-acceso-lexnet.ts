import { sumarDiasHabiles } from './calendario-judicial';
import type { ContextoCalendario } from './calendario-judicial';

const DIAS_HABILES_NOTIFICACION = 3;

/**
 * Fecha en la que se tiene por notificado un acto comunicado por LexNET (art. 162 LEC).
 * Si el destinatario accede dentro de los 3 días hábiles siguientes a la puesta a disposición,
 * vale el acceso real; si no accede (o lo hace tarde), se entiende notificado al cumplirse esos 3 días hábiles.
 */
export function fechaNotificacionEfectiva(puestaDisposicion: string, accesoReal: string | undefined, ctx: ContextoCalendario): string {
  const limite = sumarDiasHabiles(puestaDisposicion, DIAS_HABILES_NOTIFICACION, ctx);
  if (accesoReal && accesoReal >= puestaDisposicion && accesoReal <= limite) return accesoReal;
  return limite;
}
