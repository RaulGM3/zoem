const ZONA = 'Europe/Madrid';

const FORMATO_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

const formateadorMadrid = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** 'yyyy-MM-dd' -> 'dd-MM-yyyy' (formato de fecha de AEAT). */
export function fechaAeat(iso: string): string {
  const m = FORMATO_ISO.exec(iso);
  if (!m) throw new Error(`Fecha inválida (se esperaba yyyy-MM-dd): "${iso}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** ISO 8601 con huso de Europe/Madrid, precisión de segundos (p. ej. 2024-01-01T19:20:30+01:00). */
export function fechaHoraHuso(fecha: Date): string {
  if (Number.isNaN(fecha.getTime())) throw new Error('Fecha inválida');

  const partes: Record<string, string> = {};
  for (const p of formateadorMadrid.formatToParts(fecha)) partes[p.type] = p.value;

  // Offset = hora local interpretada como UTC - instante real (en segundos, sin ms).
  const localComoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );
  const instante = Math.floor(fecha.getTime() / 1000) * 1000;
  const offsetMin = Math.round((localComoUtc - instante) / 60000);

  const signo = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');

  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}${signo}${hh}:${mm}`;
}
