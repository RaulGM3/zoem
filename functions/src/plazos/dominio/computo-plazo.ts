// GENERADO desde src/app/core/plazos — no editar; ejecutar `npm run sync:plazos`
import { agostoNoComputa, motivoInhabil, siguienteHabil } from './calendario-judicial';
import type { ContextoCalendario, DiaInhabil, Jurisdiccion } from './calendario-judicial';
import type { DiaRojo } from './dias-rojos';
import { anioDe, sumarDias, sumarMeses } from './fechas-iso';

export type UnidadPlazo = 'dias' | 'meses' | 'anios';

export interface EntradaPlazo {
  /** ISO 'YYYY-MM-DD'. */
  fechaNotificacion: string;
  cantidad: number;
  unidad: UnidadPlazo;
  jurisdiccion: Jurisdiccion;
  urgente?: boolean;
  diasRojos: ReadonlyMap<string, DiaRojo>;
  /** Días que el usuario desmarcó en la revisión: se tratan como hábiles. */
  excluidosPorUsuario?: readonly string[];
  /** Años con calendario confirmado; si se informa, se avisa al tocar un año fuera de la lista. */
  aniosConCalendario?: readonly number[];
}

export interface ResultadoPlazo {
  /** Primer día del cómputo: el día siguiente a la notificación. */
  inicio: string;
  vencimiento: string;
  /** Siguiente día hábil tras el vencimiento (art. 135 LEC, hasta las 15:00). */
  diaGracia: string;
  /** Días inhábiles saltados dentro de la ventana de cómputo (hasta el vencimiento). */
  diasInhabiles: DiaInhabil[];
  advertencias: string[];
}

/** Días de agosto que no computan dentro de (desde, hasta]. */
function diasDeAgosto(desde: string, hasta: string, ctx: ContextoCalendario): string[] {
  const dias: string[] = [];
  for (let cur = sumarDias(desde, 1); cur <= hasta; cur = sumarDias(cur, 1)) {
    if (agostoNoComputa(cur, ctx)) dias.push(cur);
  }
  return dias;
}

/** Agostos que no computan cuyo día 1 cae dentro de (desde, hasta]. */
function agostosDentro(desde: string, hasta: string, ctx: ContextoCalendario): number {
  let n = 0;
  for (let anio = anioDe(desde); anio <= anioDe(hasta); anio++) {
    const uno = `${anio}-08-01`;
    if (uno > desde && uno <= hasta && agostoNoComputa(uno, ctx)) n++;
  }
  return n;
}

/**
 * Calcula el vencimiento de un plazo procesal.
 * - Días: desde el día siguiente a la notificación, solo hábiles (art. 133 LEC).
 * - Meses y años: de fecha a fecha; si el día no existe, último del mes; si es inhábil, siguiente hábil.
 */
export function calcularVencimiento(entrada: EntradaPlazo): ResultadoPlazo {
  const { fechaNotificacion, cantidad, unidad } = entrada;
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new RangeError('La cantidad del plazo debe ser un entero positivo');
  }
  const ctx: ContextoCalendario = {
    jurisdiccion: entrada.jurisdiccion,
    urgente: entrada.urgente,
    diasRojos: entrada.diasRojos,
    excluidos: entrada.excluidosPorUsuario,
  };

  const inicio = sumarDias(fechaNotificacion, 1);
  const diasInhabiles: DiaInhabil[] = [];
  let vencimiento: string;
  let advertenciaAgosto: string | undefined;

  if (unidad === 'dias') {
    let cur = fechaNotificacion;
    let contados = 0;
    while (contados < cantidad) {
      cur = sumarDias(cur, 1);
      const inhabil = motivoInhabil(cur, ctx);
      if (inhabil) diasInhabiles.push(inhabil);
      else contados++;
    }
    vencimiento = cur;
  } else {
    const meses = unidad === 'meses' ? cantidad : cantidad * 12;
    // Agosto no corre y se descuenta como MES completo (no como 31 días: eso daría un día de más).
    // Notificado en agosto: surte efecto el 1 de septiembre, así que se cuenta fecha a fecha desde el 31/08.
    const notificadoEnAgosto = agostoNoComputa(fechaNotificacion, ctx);
    const desde = notificadoEnAgosto ? `${anioDe(fechaNotificacion)}-08-31` : fechaNotificacion;
    let agostosSaltados = 0;
    let fechaAFecha = sumarMeses(desde, meses);
    for (;;) {
      const agostos = agostosDentro(desde, fechaAFecha, ctx);
      if (agostos === agostosSaltados) break;
      agostosSaltados = agostos;
      fechaAFecha = sumarMeses(desde, meses + agostosSaltados);
    }
    vencimiento = fechaAFecha;
    const diasAgosto = diasDeAgosto(fechaNotificacion, vencimiento, ctx);
    for (const fecha of diasAgosto) diasInhabiles.push({ fecha, motivo: 'agosto', etiqueta: 'Agosto inhábil' });
    const detalles: string[] = [];
    if (notificadoEnAgosto) detalles.push('la notificación en agosto surte efecto el 1 de septiembre');
    if (agostosSaltados > 0) detalles.push(`se ha${agostosSaltados > 1 ? 'n' : ''} añadido ${agostosSaltados} ${agostosSaltados > 1 ? 'meses' : 'mes'}`);
    if (detalles.length > 0) {
      advertenciaAgosto = `Agosto no computa en este plazo (art. 128.2 LJCA / art. 130 LEC): ${detalles.join('; ')}. Verifica el cómputo.`;
    }
    for (let inhabil = motivoInhabil(vencimiento, ctx); inhabil; inhabil = motivoInhabil(vencimiento, ctx)) {
      diasInhabiles.push(inhabil);
      vencimiento = sumarDias(vencimiento, 1);
    }
  }

  const diaGracia = siguienteHabil(vencimiento, ctx);

  const advertencias: string[] = advertenciaAgosto ? [advertenciaAgosto] : [];
  if (entrada.aniosConCalendario) {
    for (let anio = anioDe(fechaNotificacion); anio <= anioDe(diaGracia); anio++) {
      if (!entrada.aniosConCalendario.includes(anio)) advertencias.push(`No hay días inhábiles confirmados para ${anio}`);
    }
  }

  return { inicio, vencimiento, diaGracia, diasInhabiles, advertencias };
}
