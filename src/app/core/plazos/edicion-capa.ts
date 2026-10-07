import type { ComunidadAutonoma } from '../../interfaces/company';
import type { AmbitoDiaRojo, CapaAnio } from './dias-rojos';
import { idCapaAutonomica, idCapaPartido } from './dias-rojos';
import { anioDe } from './fechas-iso';
import { partidoPorId } from './partidos-judiciales';

/** Quita un día de la capa y lo recuerda en `descartados` para que la IA no lo vuelva a proponer. */
export function quitarDia(capa: CapaAnio, fecha: string): CapaAnio {
  return {
    ...capa,
    diasRojos: capa.diasRojos.filter((d) => d.fecha !== fecha),
    descartados: capa.descartados.includes(fecha) ? [...capa.descartados] : [...capa.descartados, fecha],
  };
}

/** Confirma un día propuesto; si ya estaba confirmado conserva quién y cuándo lo hizo. */
export function confirmarDia(capa: CapaAnio, fecha: string, uid: string, ahoraIso: string): CapaAnio {
  return {
    ...capa,
    diasRojos: capa.diasRojos.map((d) =>
      d.fecha === fecha && d.estado !== 'confirmado'
        ? { ...d, estado: 'confirmado', confirmadoPor: uid, confirmadoAt: ahoraIso }
        : { ...d },
    ),
  };
}

export function confirmarTodos(capa: CapaAnio, uid: string, ahoraIso: string): CapaAnio {
  return capa.diasRojos.reduce((acc, d) => (d.estado === 'propuesto' ? confirmarDia(acc, d.fecha, uid, ahoraIso) : acc), {
    ...capa,
    diasRojos: capa.diasRojos.map((d) => ({ ...d })),
  });
}

/** Añade (o sustituye) un día manual, confirmado de entrada por quien lo introduce. */
export function anadirDiaManual(
  capa: CapaAnio,
  dia: { fecha: string; nombre: string; ambito: AmbitoDiaRojo },
  uid: string,
  ahoraIso: string,
): CapaAnio {
  return {
    ...capa,
    diasRojos: [
      ...capa.diasRojos.filter((d) => d.fecha !== dia.fecha),
      { ...dia, estado: 'confirmado', origen: 'manual', confirmadoPor: uid, confirmadoAt: ahoraIso },
    ],
    descartados: capa.descartados.filter((f) => f !== dia.fecha),
  };
}

/** Años que toca un cómputo: el plazo puede cruzar año nuevo. */
export function aniosAfectados(desde: string, hasta: string): number[] {
  const anios: number[] = [];
  for (let a = anioDe(desde); a <= anioDe(hasta); a++) anios.push(a);
  return anios;
}

export interface CapasResueltas {
  ca: string;
  partido?: string;
  advertencias: 'sin_partido'[];
}

/**
 * Capas de calendario de un caso: el partido judicial manda (su CA y su capa local);
 * sin partido (o desconocido) se usa la CA de la empresa y se avisa.
 */
export function resolverCapas(
  caso: { partidoJudicialId?: string },
  caEmpresa: ComunidadAutonoma,
): CapasResueltas {
  const partido = caso.partidoJudicialId ? partidoPorId(caso.partidoJudicialId) : undefined;
  if (partido) return { ca: idCapaAutonomica(partido.ca), partido: idCapaPartido(partido.id), advertencias: [] };
  return { ca: idCapaAutonomica(caEmpresa), advertencias: ['sin_partido'] };
}
