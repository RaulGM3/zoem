/** Utilidades de fechas ISO 'YYYY-MM-DD' en UTC (sin depender de la zona horaria local). */

const aMs = (iso: string): number => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};

const aIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** 0 = domingo … 6 = sábado. */
export const diaSemana = (iso: string): number => new Date(aMs(iso)).getUTCDay();

export const sumarDias = (iso: string, dias: number): string => aIso(aMs(iso) + dias * 86_400_000);

/** Suma meses de fecha a fecha; si el día no existe en el mes destino, usa el último día de ese mes. */
export function sumarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const total = a * 12 + (m - 1) + meses;
  const anio = Math.floor(total / 12);
  const mes = total % 12;
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return aIso(Date.UTC(anio, mes, Math.min(d, ultimo)));
}

export const anioDe = (iso: string): number => Number(iso.slice(0, 4));
