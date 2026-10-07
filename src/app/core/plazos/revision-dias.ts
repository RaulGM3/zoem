import type { DiaInhabil, MotivoInhabil } from './calendario-judicial';
import { formatearFechaEs } from './plazo-evento';

/** Elemento de la lista "Días inhábiles en este plazo": un día suelto o un grupo (p. ej. agosto). */
export interface ItemRevision {
  clave: string;
  etiqueta: string;
  motivo: MotivoInhabil;
  fechas: string[];
  fuenteUrl?: string;
}

const MIN_DIAS_GRUPO = 5;

/** Acumula los días inhábiles vistos: al desmarcar uno desaparece del resultado pero debe poder volver a marcarse. */
export function fusionarCandidatos(previos: readonly DiaInhabil[], actuales: readonly DiaInhabil[]): DiaInhabil[] {
  const porFecha = new Map<string, DiaInhabil>();
  for (const dia of [...previos, ...actuales]) porFecha.set(dia.fecha, dia);
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Días a listar: los inhábiles actuales y los desmarcados por el usuario que siguen dentro de la ventana (hasta `limite`, p. ej. el día de gracia). */
export function diasAMostrar(
  candidatos: readonly DiaInhabil[],
  actuales: readonly DiaInhabil[],
  excluidos: readonly string[],
  limite: string,
): DiaInhabil[] {
  const vigentes = new Set(actuales.map((x) => x.fecha));
  return candidatos.filter((c) => vigentes.has(c.fecha) || (excluidos.includes(c.fecha) && c.fecha <= limite));
}

export function agruparParaRevision(dias: readonly DiaInhabil[], fuentes: Readonly<Record<string, string>>): ItemRevision[] {
  const porAnio = new Map<string, DiaInhabil[]>();
  for (const dia of dias) {
    if (dia.motivo !== 'agosto') continue;
    const anio = dia.fecha.slice(0, 4);
    porAnio.set(anio, [...(porAnio.get(anio) ?? []), dia]);
  }
  const agrupados = new Set([...porAnio.entries()].filter(([, v]) => v.length >= MIN_DIAS_GRUPO).map(([anio]) => anio));

  const items: ItemRevision[] = [];
  for (const dia of dias) {
    const anio = dia.fecha.slice(0, 4);
    if (dia.motivo === 'agosto' && agrupados.has(anio)) {
      const clave = `agosto-${anio}`;
      if (items.some((i) => i.clave === clave)) continue;
      const fechas = porAnio.get(anio)!.map((x) => x.fecha);
      items.push({ clave, etiqueta: `Agosto ${anio} (${fechas.length} días)`, motivo: 'agosto', fechas });
    } else {
      const fuenteUrl = fuentes[dia.fecha];
      items.push({ clave: dia.fecha, etiqueta: dia.etiqueta, motivo: dia.motivo, fechas: [dia.fecha], ...(fuenteUrl ? { fuenteUrl } : {}) });
    }
  }
  return items.sort((a, b) => a.fechas[0].localeCompare(b.fechas[0]));
}

export const itemMarcado = (item: ItemRevision, excluidos: readonly string[]): boolean =>
  item.fechas.every((f) => !excluidos.includes(f));

/** `marcado` = el día se considera inhábil. Desmarcar lo añade a excluidos. */
export function alternarDias(excluidos: readonly string[], fechas: readonly string[], marcado: boolean): string[] {
  if (marcado) return excluidos.filter((f) => !fechas.includes(f));
  return [...excluidos, ...fechas.filter((f) => !excluidos.includes(f))];
}

export const fechaItem = (item: ItemRevision): string =>
  item.fechas.length === 1 ? formatearFechaEs(item.fechas[0]) : `${formatearFechaEs(item.fechas[0])} – ${formatearFechaEs(item.fechas[item.fechas.length - 1])}`;
