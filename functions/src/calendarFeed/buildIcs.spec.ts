import { describe, it, expect } from 'vitest';
import { buildIcs, type IcsEvento, type IcsHito } from './buildIcs';

const NOW = new Date('2026-01-15T10:00:00Z');
const BASE_URL = 'https://app.zoem.es';

function evento(overrides: Partial<IcsEvento> = {}): IcsEvento {
  return {
    id: 'ev1',
    titulo: 'Reunión con cliente',
    fecha: '2026-02-10',
    todoDia: false,
    recurrencia: 'ninguna',
    ...overrides,
  };
}

function hito(overrides: Partial<IcsHito> = {}): IcsHito {
  return {
    id: 'h1',
    casoId: 'caso1',
    titulo: 'Presentar demanda',
    estado: 'pendiente',
    ...overrides,
  };
}

describe('buildIcs', () => {
  it('genera una cabecera VCALENDAR válida con timezone Europe/Madrid', () => {
    const ics = buildIcs({ eventos: [], hitos: [], uid: 'u1', appBaseUrl: BASE_URL }, NOW);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('X-WR-TIMEZONE:Europe/Madrid');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('evento de todo el día usa DTSTART/DTEND con VALUE=DATE y DTEND exclusivo (+1 día)', () => {
    const ics = buildIcs(
      { eventos: [evento({ fecha: '2026-03-01', todoDia: true })], hitos: [], uid: 'u1', appBaseUrl: BASE_URL },
      NOW,
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20260301');
    expect(ics).toContain('DTEND;VALUE=DATE:20260302');
    expect(ics).not.toContain('TZID');
  });

  it('evento con hora usa DTSTART/DTEND con TZID=Europe/Madrid y hora local', () => {
    const ics = buildIcs(
      {
        eventos: [evento({ fecha: '2026-03-01', todoDia: false, horaInicio: '09:30', horaFin: '10:15' })],
        hitos: [],
        uid: 'u1',
        appBaseUrl: BASE_URL,
      },
      NOW,
    );
    expect(ics).toContain('DTSTART;TZID=Europe/Madrid:20260301T093000');
    expect(ics).toContain('DTEND;TZID=Europe/Madrid:20260301T101500');
  });

  it('UID es estable: evento-{id}@zoem', () => {
    const ics = buildIcs({ eventos: [evento({ id: 'abc123' })], hitos: [], uid: 'u1', appBaseUrl: BASE_URL }, NOW);
    expect(ics).toContain('UID:evento-abc123@zoem');
  });

  describe('RRULE por recurrencia', () => {
    it('diaria con recurrenciaFin → FREQ=DAILY;UNTIL=...', () => {
      const ics = buildIcs(
        {
          eventos: [
            evento({
              recurrencia: 'diaria',
              todoDia: true,
              fecha: '2026-01-01',
              recurrenciaFin: '2026-01-31',
            }),
          ],
          hitos: [],
          uid: 'u1',
          appBaseUrl: BASE_URL,
        },
        NOW,
      );
      expect(ics).toContain('RRULE:FREQ=DAILY;UNTIL=20260131');
    });

    it('semanal con recurrenciaOcurrencias → FREQ=WEEKLY;COUNT=n', () => {
      const ics = buildIcs(
        {
          eventos: [evento({ recurrencia: 'semanal', recurrenciaOcurrencias: 8 })],
          hitos: [],
          uid: 'u1',
          appBaseUrl: BASE_URL,
        },
        NOW,
      );
      expect(ics).toContain('RRULE:FREQ=WEEKLY;COUNT=8');
    });

    it('mensual sin fin ni ocurrencias → FREQ=MONTHLY sin UNTIL/COUNT', () => {
      const ics = buildIcs(
        { eventos: [evento({ recurrencia: 'mensual' })], hitos: [], uid: 'u1', appBaseUrl: BASE_URL },
        NOW,
      );
      expect(ics).toMatch(/RRULE:FREQ=MONTHLY\r\n/);
    });

    it('anual con hora y recurrenciaFin usa UNTIL en UTC con sufijo Z', () => {
      const ics = buildIcs(
        {
          eventos: [
            evento({
              recurrencia: 'anual',
              todoDia: false,
              horaInicio: '09:00',
              horaFin: '10:00',
              recurrenciaFin: '2027-06-15',
            }),
          ],
          hitos: [],
          uid: 'u1',
          appBaseUrl: BASE_URL,
        },
        NOW,
      );
      // Verano en Madrid: CEST = UTC+2, 23:59:59 local → 21:59:59Z
      expect(ics).toContain('RRULE:FREQ=YEARLY;UNTIL=20270615T215959Z');
    });

    it('ninguna recurrencia → no emite RRULE', () => {
      const ics = buildIcs(
        { eventos: [evento({ recurrencia: 'ninguna' })], hitos: [], uid: 'u1', appBaseUrl: BASE_URL },
        NOW,
      );
      expect(ics).not.toContain('RRULE');
    });
  });

  describe('estado → STATUS', () => {
    it('cancelado → STATUS:CANCELLED', () => {
      const ics = buildIcs(
        { eventos: [evento({ estado: 'cancelado' })], hitos: [], uid: 'u1', appBaseUrl: BASE_URL },
        NOW,
      );
      expect(ics).toContain('STATUS:CANCELLED');
    });

    it('tentativo → STATUS:TENTATIVE', () => {
      const ics = buildIcs(
        { eventos: [evento({ estado: 'tentativo' })], hitos: [], uid: 'u1', appBaseUrl: BASE_URL },
        NOW,
      );
      expect(ics).toContain('STATUS:TENTATIVE');
    });

    it('confirmado → STATUS:CONFIRMED', () => {
      const ics = buildIcs(
        { eventos: [evento({ estado: 'confirmado' })], hitos: [], uid: 'u1', appBaseUrl: BASE_URL },
        NOW,
      );
      expect(ics).toContain('STATUS:CONFIRMED');
    });
  });

  it('escapa comas, punto y coma y saltos de línea en SUMMARY/DESCRIPTION', () => {
    const ics = buildIcs(
      {
        eventos: [
          evento({
            titulo: 'Reunión; urgente, importante',
            descripcion: 'Línea uno\nLínea dos, con coma; y punto y coma',
          }),
        ],
        hitos: [],
        uid: 'u1',
        appBaseUrl: BASE_URL,
      },
      NOW,
    );
    expect(ics).toContain('SUMMARY:Reunión\\; urgente\\, importante');
    expect(ics).toContain('Línea uno\\nLínea dos\\, con coma\\; y punto y coma');
  });

  describe('hitos', () => {
    it('filtra por asignadosA: excluye hitos donde el uid no está asignado', () => {
      const ics = buildIcs(
        {
          eventos: [],
          hitos: [hito({ asignadosA: ['otro-usuario'], fechaEstimada: '2026-04-01' })],
          uid: 'u1',
          appBaseUrl: BASE_URL,
        },
        NOW,
      );
      expect(ics).not.toContain('[Hito]');
    });

    it('incluye hito cuando el uid está en asignadosA', () => {
      const ics = buildIcs(
        {
          eventos: [],
          hitos: [hito({ id: 'h1', asignadosA: ['u1', 'u2'], fechaEstimada: '2026-04-01' })],
          uid: 'u1',
          appBaseUrl: BASE_URL,
        },
        NOW,
      );
      expect(ics).toContain('SUMMARY:[Hito] Presentar demanda');
      expect(ics).toContain('UID:hito-h1-allday@zoem');
      expect(ics).toContain('URL:https://app.zoem.es/casos/caso1');
    });

    it('incluye hito por asignadoA legacy (string simple)', () => {
      const ics = buildIcs(
        {
          eventos: [],
          hitos: [hito({ id: 'h2', asignadoA: 'u1', fechaEstimada: '2026-04-01' })],
          uid: 'u1',
          appBaseUrl: BASE_URL,
        },
        NOW,
      );
      expect(ics).toContain('UID:hito-h2-allday@zoem');
    });

    it('hito sin bloques pero con fechaEstimada → VEVENT de todo el día', () => {
      const ics = buildIcs(
        {
          eventos: [],
          hitos: [hito({ id: 'h3', asignadosA: ['u1'], fechaEstimada: '2026-05-01' })],
          uid: 'u1',
          appBaseUrl: BASE_URL,
        },
        NOW,
      );
      expect(ics).toContain('DTSTART;VALUE=DATE:20260501');
    });

    it('hito con registrosHoras genera un VEVENT por cada bloque', () => {
      const ics = buildIcs(
        {
          eventos: [],
          hitos: [
            hito({
              id: 'h4',
              asignadosA: ['u1'],
              registrosHoras: [
                { id: 'b1', userId: 'u1', fecha: '2026-05-02', horaInicio: '08:00', horaFin: '12:00' },
                { id: 'b2', userId: 'u1', fecha: '2026-05-03', horaInicio: '08:00', horaFin: '10:00' },
              ],
            }),
          ],
          uid: 'u1',
          appBaseUrl: BASE_URL,
        },
        NOW,
      );
      expect(ics).toContain('UID:hito-h4-b1@zoem');
      expect(ics).toContain('UID:hito-h4-b2@zoem');
      expect(ics).toContain('DTSTART;TZID=Europe/Madrid:20260502T080000');
      expect(ics).toContain('DTSTART;TZID=Europe/Madrid:20260503T080000');
    });

    it('hito legacy con horaAgenda/duracionAgenda sintetiza un bloque', () => {
      const ics = buildIcs(
        {
          eventos: [],
          hitos: [
            hito({
              id: 'h5',
              asignadosA: ['u1'],
              fechaEstimada: '2026-06-01',
              horaAgenda: '09:00',
              duracionAgenda: 90,
            }),
          ],
          uid: 'u1',
          appBaseUrl: BASE_URL,
        },
        NOW,
      );
      expect(ics).toContain('UID:hito-h5-agenda@zoem');
      expect(ics).toContain('DTSTART;TZID=Europe/Madrid:20260601T090000');
      expect(ics).toContain('DTEND;TZID=Europe/Madrid:20260601T103000');
    });

    it('hito cancelado → STATUS:CANCELLED', () => {
      const ics = buildIcs(
        {
          eventos: [],
          hitos: [hito({ id: 'h6', asignadosA: ['u1'], fechaEstimada: '2026-06-05', estado: 'cancelado' })],
          uid: 'u1',
          appBaseUrl: BASE_URL,
        },
        NOW,
      );
      expect(ics).toContain('STATUS:CANCELLED');
    });
  });

  it('pliega líneas largas a 75 caracteres con continuación CRLF + espacio', () => {
    const longTitle = 'A'.repeat(120);
    const ics = buildIcs(
      { eventos: [evento({ titulo: longTitle })], hitos: [], uid: 'u1', appBaseUrl: BASE_URL },
      NOW,
    );
    const summaryLineStart = ics.indexOf('SUMMARY:');
    const nextCrlf = ics.indexOf('\r\n', summaryLineStart);
    const firstPhysicalLine = ics.slice(summaryLineStart, nextCrlf);
    expect(firstPhysicalLine.length).toBeLessThanOrEqual(75);
    // La continuación empieza con un espacio.
    expect(ics.slice(nextCrlf + 2, nextCrlf + 3)).toBe(' ');
  });
});
