/**
 * Utilidades RFC 5545 puras: escaping de texto, folding de líneas y
 * formateo de fechas para el feed ICS. Sin dependencias externas —
 * ver justificación de la elección en buildIcs.ts.
 */

/** Escapa los caracteres especiales de un campo TEXT de iCalendar (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Pliega una línea de contenido a un máximo de 75 octetos por línea (RFC 5545 §3.1),
 * insertando CRLF + un espacio como continuación. Usamos longitud de code units
 * como aproximación de octetos: suficiente para el contenido ASCII/Latin-1 típico
 * de este feed (títulos, descripciones); no perseguimos exactitud UTF-8 estricta.
 */
export function foldIcsLine(line: string): string {
  const LIMIT = 75;
  if (line.length <= LIMIT) return line;

  const parts: string[] = [];
  let rest = line;
  // La primera línea permite 75 octetos completos.
  parts.push(rest.slice(0, LIMIT));
  rest = rest.slice(LIMIT);
  // Las líneas de continuación empiezan con un espacio, que cuenta para el límite.
  while (rest.length > 0) {
    const chunk = rest.slice(0, LIMIT - 1);
    parts.push(' ' + chunk);
    rest = rest.slice(LIMIT - 1);
  }
  return parts.join('\r\n');
}

/** Serializa una lista de líneas de contenido ICS, plegando cada una. */
export function joinIcsLines(lines: string[]): string {
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD → YYYYMMDD (formato DATE de iCalendar). */
export function toIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/** YYYY-MM-DD + HH:mm → YYYYMMDDTHHMMSS (hora local, sin sufijo de zona). */
export function toIcsLocalDateTime(dateStr: string, timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  return `${toIcsDate(dateStr)}T${pad2(h ?? 0)}${pad2(m ?? 0)}00`;
}

/** Formatea un Date (instante UTC) como YYYYMMDDTHHMMSSZ. */
export function toIcsUtcDateTime(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

/** Suma `days` días a una fecha YYYY-MM-DD, devolviendo YYYY-MM-DD (aritmética UTC pura). */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/**
 * Devuelve el offset (en minutos) de Europe/Madrid respecto a UTC para un
 * instante UTC dado, aplicando la regla europea de horario de verano: CEST
 * (+120) desde el último domingo de marzo a la 01:00 UTC hasta el último
 * domingo de octubre a la 01:00 UTC; CET (+60) el resto del año.
 */
export function madridOffsetMinutes(utcDate: Date): number {
  const year = utcDate.getUTCFullYear();
  const dstStart = lastSundayAt1amUtc(year, 2); // marzo (índice 2)
  const dstEnd = lastSundayAt1amUtc(year, 9); // octubre (índice 9)
  const t = utcDate.getTime();
  return t >= dstStart.getTime() && t < dstEnd.getTime() ? 120 : 60;
}

function lastSundayAt1amUtc(year: number, monthIndex: number): Date {
  // Primer día del mes siguiente, retrocedemos hasta el último domingo.
  const firstOfNextMonth = new Date(Date.UTC(year, monthIndex + 1, 1, 1, 0, 0));
  const lastDay = new Date(firstOfNextMonth.getTime() - 24 * 60 * 60 * 1000);
  const offsetToSunday = lastDay.getUTCDay(); // 0 = domingo
  lastDay.setUTCDate(lastDay.getUTCDate() - offsetToSunday);
  lastDay.setUTCHours(1, 0, 0, 0);
  return lastDay;
}

/** Convierte una fecha/hora local de Europe/Madrid a un instante UTC (Date). */
export function madridLocalToUtc(
  dateStr: string,
  hour: number,
  minute: number,
  second = 0,
): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, hour, minute, second));
  const offset = madridOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60_000);
}
