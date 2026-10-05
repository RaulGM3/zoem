const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Tiempo relativo en español ("hace 5 min"). Pura: `now` se inyecta, nunca se lee del reloj. */
export function tiempoRelativo(date: Date | null, now: Date): string {
  if (!date) return '';
  const diff = now.getTime() - date.getTime();
  if (diff < MIN) return 'ahora';
  if (diff < HOUR) return `hace ${Math.floor(diff / MIN)} min`;
  if (diff < DAY) return `hace ${Math.floor(diff / HOUR)} h`;
  if (diff < 7 * DAY) return `hace ${Math.floor(diff / DAY)} d`;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
