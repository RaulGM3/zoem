import {
  addDaysToDateStr,
  escapeIcsText,
  joinIcsLines,
  madridLocalToUtc,
  toIcsDate,
  toIcsLocalDateTime,
  toIcsUtcDateTime,
} from './icsUtils';

/*
 * Generador ICS puro (sin I/O). Elegimos escribir RFC 5545 a mano en vez de
 * usar `ical-generator`:
 *  - `functions/` compila a CommonJS (tsconfig `module: commonjs`); las
 *    versiones recientes de `ical-generator` son ESM-first, lo que añade
 *    fricción de interop innecesaria para un formato de salida tan acotado.
 *  - Necesitamos control fino sobre RRULE (UNTIL vs COUNT, DATE vs
 *    DATE-TIME) y sobre cuándo se sintetiza un evento desde un hito legacy
 *    (horaAgenda) — más simple de expresar directamente.
 *  - Cero dependencias nuevas en runtime de una Cloud Function pequeña.
 * Si el feed creciera (alarms, attendees, exdates…) reconsiderar la librería.
 */

export type IcsEventoEstado = 'confirmado' | 'tentativo' | 'en_progreso' | 'completado' | 'cancelado';
export type IcsEventoRecurrencia = 'ninguna' | 'diaria' | 'semanal' | 'mensual' | 'anual';
export type IcsHitoEstado = 'pendiente' | 'en_progreso' | 'completado' | 'cancelado';

export interface IcsRegistroHoraHito {
  id: string;
  userId: string;
  fecha: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
  horaFin: string; // HH:mm
}

export interface IcsEvento {
  id: string;
  titulo: string;
  descripcion?: string;
  link?: string;
  lugar?: string;
  fecha: string; // YYYY-MM-DD
  horaInicio?: string; // HH:mm
  horaFin?: string; // HH:mm
  todoDia: boolean;
  estado?: IcsEventoEstado;
  recurrencia: IcsEventoRecurrencia;
  recurrenciaFin?: string; // YYYY-MM-DD
  recurrenciaOcurrencias?: number;
}

export interface IcsHito {
  id: string;
  casoId: string;
  casoTitulo?: string;
  titulo: string;
  fechaEstimada?: string; // YYYY-MM-DD
  asignadoA?: string; // legacy
  asignadosA?: string[];
  estado: IcsHitoEstado;
  horaAgenda?: string; // HH:mm — legacy
  duracionAgenda?: number; // minutos — legacy
  registrosHoras?: IcsRegistroHoraHito[];
}

export interface BuildIcsInput {
  eventos: IcsEvento[];
  hitos: IcsHito[];
  /** uid del suscriptor del feed: filtra qué hitos se incluyen. */
  uid: string;
  /** Base URL de la app (sin barra final), ej. https://app.zoem.es */
  appBaseUrl: string;
}

const RRULE_FREQ: Record<Exclude<IcsEventoRecurrencia, 'ninguna'>, 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'> = {
  diaria: 'DAILY',
  semanal: 'WEEKLY',
  mensual: 'MONTHLY',
  anual: 'YEARLY',
};

type IcsStatus = 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';

interface VEventSpec {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  allDay: boolean;
  fecha: string;
  horaInicio?: string;
  horaFin?: string;
  status?: IcsStatus;
  rrule?: { freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'; until?: string; count?: number };
}

export function buildIcs(input: BuildIcsInput, now: Date = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zoem//Calendar Feed//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Zoem',
    'X-WR-TIMEZONE:Europe/Madrid',
  ];

  for (const evento of input.eventos) {
    lines.push(...buildEventoVEvent(evento, input.appBaseUrl, now));
  }
  for (const hito of input.hitos) {
    lines.push(...buildHitoVEvents(hito, input.uid, input.appBaseUrl, now));
  }

  lines.push('END:VCALENDAR');
  return joinIcsLines(lines);
}

function mapEventoStatus(estado?: IcsEventoEstado): IcsStatus {
  if (estado === 'cancelado') return 'CANCELLED';
  if (estado === 'tentativo') return 'TENTATIVE';
  return 'CONFIRMED';
}

function buildEventoVEvent(evento: IcsEvento, appBaseUrl: string, now: Date): string[] {
  const rrule =
    evento.recurrencia !== 'ninguna'
      ? {
          freq: RRULE_FREQ[evento.recurrencia],
          ...(evento.recurrenciaFin ? { until: evento.recurrenciaFin } : {}),
          ...(!evento.recurrenciaFin && evento.recurrenciaOcurrencias
            ? { count: evento.recurrenciaOcurrencias }
            : {}),
        }
      : undefined;

  return buildVEventLines(
    {
      uid: `evento-${evento.id}@zoem`,
      summary: evento.titulo,
      description: evento.descripcion,
      location: evento.lugar,
      url: evento.link ?? `${appBaseUrl}/eventos`,
      allDay: evento.todoDia,
      fecha: evento.fecha,
      horaInicio: evento.horaInicio,
      horaFin: evento.horaFin,
      status: mapEventoStatus(evento.estado),
      rrule,
    },
    now,
  );
}

function isAssignedToHito(hito: IcsHito, uid: string): boolean {
  return (hito.asignadosA?.includes(uid) ?? false) || hito.asignadoA === uid;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildHitoVEvents(hito: IcsHito, uid: string, appBaseUrl: string, now: Date): string[] {
  if (!isAssignedToHito(hito, uid)) return [];

  const url = `${appBaseUrl}/casos/${hito.casoId}`;
  const summary = `[Hito] ${hito.titulo}`;
  const status: IcsStatus = hito.estado === 'cancelado' ? 'CANCELLED' : 'CONFIRMED';

  let blocks = hito.registrosHoras;
  // Compat: hito legacy con solo horaAgenda/duracionAgenda (sin registrosHoras) —
  // mismo criterio que calendario.ts hitoToItem().
  if ((!blocks || blocks.length === 0) && hito.horaAgenda && hito.fechaEstimada) {
    const start = timeToMinutes(hito.horaAgenda);
    const dur = hito.duracionAgenda ?? 60;
    blocks = [
      {
        id: 'agenda',
        userId: uid,
        fecha: hito.fechaEstimada,
        horaInicio: hito.horaAgenda,
        horaFin: minutesToTime(start + dur),
      },
    ];
  }

  if (blocks && blocks.length > 0) {
    return blocks.flatMap((block) =>
      buildVEventLines(
        {
          uid: `hito-${hito.id}-${block.id}@zoem`,
          summary,
          url,
          allDay: false,
          fecha: block.fecha,
          horaInicio: block.horaInicio,
          horaFin: block.horaFin,
          status,
        },
        now,
      ),
    );
  }

  if (hito.fechaEstimada) {
    return buildVEventLines(
      {
        uid: `hito-${hito.id}-allday@zoem`,
        summary,
        url,
        allDay: true,
        fecha: hito.fechaEstimada,
        status,
      },
      now,
    );
  }

  return [];
}

function buildVEventLines(spec: VEventSpec, now: Date): string[] {
  const lines: string[] = ['BEGIN:VEVENT'];
  lines.push(`UID:${spec.uid}`);
  lines.push(`DTSTAMP:${toIcsUtcDateTime(now)}`);

  if (spec.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(spec.fecha)}`);
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(addDaysToDateStr(spec.fecha, 1))}`);
  } else {
    const horaInicio = spec.horaInicio ?? '00:00';
    const horaFin = spec.horaFin ?? horaInicio;
    lines.push(`DTSTART;TZID=Europe/Madrid:${toIcsLocalDateTime(spec.fecha, horaInicio)}`);
    lines.push(`DTEND;TZID=Europe/Madrid:${toIcsLocalDateTime(spec.fecha, horaFin)}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(spec.summary)}`);
  if (spec.description) lines.push(`DESCRIPTION:${escapeIcsText(spec.description)}`);
  if (spec.location) lines.push(`LOCATION:${escapeIcsText(spec.location)}`);
  if (spec.url) lines.push(`URL:${spec.url}`);
  if (spec.status) lines.push(`STATUS:${spec.status}`);

  if (spec.rrule) {
    const parts = [`FREQ=${spec.rrule.freq}`];
    if (spec.rrule.until) {
      parts.push(
        `UNTIL=${
          spec.allDay
            ? toIcsDate(spec.rrule.until)
            : toIcsUtcDateTime(madridLocalToUtc(spec.rrule.until, 23, 59, 59))
        }`,
      );
    } else if (spec.rrule.count) {
      parts.push(`COUNT=${spec.rrule.count}`);
    }
    lines.push(`RRULE:${parts.join(';')}`);
  }

  lines.push('END:VEVENT');
  return lines;
}
