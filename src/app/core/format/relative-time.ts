/**
 * Tiempo relativo legible en español neutro ("hace 2 min", "hace 3h", "hace 5d").
 * Función PURA: recibe el momento y el "ahora" explícito para ser testeable y no
 * depender de globals. `from` puede ser un epoch en ms o un Date.
 */
export function relativeTime(from: number | Date, now: number = Date.now()): string {
  const ms = from instanceof Date ? from.getTime() : from;
  const diffMin = Math.floor((now - ms) / 60000);
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `hace ${diffHrs}h`;
  return `hace ${Math.floor(diffHrs / 24)}d`;
}
