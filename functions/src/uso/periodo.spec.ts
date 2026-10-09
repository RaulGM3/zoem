import { describe, expect, it } from 'vitest';
import { ZONA_POR_DEFECTO, esZonaValida, periodoMensual, zonaDeEmpresa } from './periodo';

const iso = (d: Date) => d.toISOString();

describe('periodoMensual', () => {
  it('UTC puro: mes natural', () => {
    const p = periodoMensual(new Date('2026-03-15T10:00:00Z'), 'UTC');
    expect(p.clave).toBe('2026-03');
    expect(iso(p.inicio)).toBe('2026-03-01T00:00:00.000Z');
    expect(iso(p.fin)).toBe('2026-04-01T00:00:00.000Z');
  });

  it('Madrid invierno (UTC+1) y verano (UTC+2)', () => {
    const inv = periodoMensual(new Date('2026-01-20T12:00:00Z'), 'Europe/Madrid');
    expect(inv.clave).toBe('2026-01');
    expect(iso(inv.inicio)).toBe('2025-12-31T23:00:00.000Z');
    expect(iso(inv.fin)).toBe('2026-01-31T23:00:00.000Z');
    const ver = periodoMensual(new Date('2026-07-20T12:00:00Z'), 'Europe/Madrid');
    expect(iso(ver.inicio)).toBe('2026-06-30T22:00:00.000Z');
    expect(iso(ver.fin)).toBe('2026-07-31T22:00:00.000Z');
  });

  it('Madrid: marzo contiene el salto a verano (30/03/2026 02:00 -> 03:00) y su fin ya es UTC+2', () => {
    const p = periodoMensual(new Date('2026-03-29T12:00:00Z'), 'Europe/Madrid');
    expect(p.clave).toBe('2026-03');
    expect(iso(p.inicio)).toBe('2026-02-28T23:00:00.000Z'); // UTC+1
    expect(iso(p.fin)).toBe('2026-03-31T22:00:00.000Z'); // UTC+2
  });

  it('Madrid: octubre contiene el salto a invierno (25/10/2026)', () => {
    const p = periodoMensual(new Date('2026-10-26T12:00:00Z'), 'Europe/Madrid');
    expect(iso(p.inicio)).toBe('2026-09-30T22:00:00.000Z'); // UTC+2
    expect(iso(p.fin)).toBe('2026-10-31T23:00:00.000Z'); // UTC+1
  });

  it('cerca de la medianoche: 31/01 23:30 UTC ya es febrero en Madrid, no en Lisboa', () => {
    const t = new Date('2026-01-31T23:30:00Z');
    expect(periodoMensual(t, 'Europe/Madrid').clave).toBe('2026-02');
    expect(periodoMensual(t, 'Atlantic/Canary').clave).toBe('2026-01');
    expect(periodoMensual(t, 'UTC').clave).toBe('2026-01');
  });

  it('el instante exacto de fin pertenece al mes siguiente; un ms antes, al actual', () => {
    const p = periodoMensual(new Date('2026-07-10T00:00:00Z'), 'Europe/Madrid');
    expect(periodoMensual(new Date(p.fin.getTime() - 1), 'Europe/Madrid').clave).toBe('2026-07');
    const sig = periodoMensual(p.fin, 'Europe/Madrid');
    expect(sig.clave).toBe('2026-08');
    expect(sig.inicio.getTime()).toBe(p.fin.getTime());
    expect(periodoMensual(p.inicio, 'Europe/Madrid').clave).toBe('2026-07');
    expect(periodoMensual(new Date(p.inicio.getTime() - 1), 'Europe/Madrid').clave).toBe('2026-06');
  });

  it('América (oeste): 01/03 02:00 UTC sigue siendo febrero en México y Bogotá', () => {
    const t = new Date('2026-03-01T02:00:00Z');
    expect(periodoMensual(t, 'America/Mexico_City').clave).toBe('2026-02');
    expect(periodoMensual(t, 'America/Bogota').clave).toBe('2026-02');
    expect(periodoMensual(t, 'Europe/Madrid').clave).toBe('2026-03');
  });

  it('Buenos Aires (sin DST, UTC-3 todo el año)', () => {
    const a = periodoMensual(new Date('2026-01-15T12:00:00Z'), 'America/Argentina/Buenos_Aires');
    expect(iso(a.inicio)).toBe('2026-01-01T03:00:00.000Z');
    expect(iso(a.fin)).toBe('2026-02-01T03:00:00.000Z');
    const b = periodoMensual(new Date('2026-07-15T12:00:00Z'), 'America/Argentina/Buenos_Aires');
    expect(iso(b.inicio)).toBe('2026-07-01T03:00:00.000Z');
  });

  it('Santiago (DST austral): enero UTC-3 (verano), julio UTC-4 (invierno)', () => {
    const ene = periodoMensual(new Date('2026-01-15T12:00:00Z'), 'America/Santiago');
    expect(iso(ene.inicio)).toBe('2026-01-01T03:00:00.000Z');
    expect(iso(ene.fin)).toBe('2026-02-01T03:00:00.000Z');
    const jul = periodoMensual(new Date('2026-07-15T12:00:00Z'), 'America/Santiago');
    expect(iso(jul.inicio)).toBe('2026-07-01T04:00:00.000Z');
    expect(iso(jul.fin)).toBe('2026-08-01T04:00:00.000Z');
  });

  it('Santiago: abril 2026 cruza el fin del verano (04/04) => inicio UTC-3, fin UTC-4', () => {
    const p = periodoMensual(new Date('2026-04-10T12:00:00Z'), 'America/Santiago');
    expect(iso(p.inicio)).toBe('2026-04-01T03:00:00.000Z');
    expect(iso(p.fin)).toBe('2026-05-01T04:00:00.000Z');
  });

  it('cambio de año', () => {
    const dic = periodoMensual(new Date('2026-12-31T22:30:00Z'), 'Europe/Madrid');
    expect(dic.clave).toBe('2026-12'); // 23:30 hora local
    const ene = periodoMensual(new Date('2026-12-31T23:30:00Z'), 'Europe/Madrid');
    expect(ene.clave).toBe('2027-01');
    expect(iso(ene.inicio)).toBe('2026-12-31T23:00:00.000Z');
    expect(iso(ene.fin)).toBe('2027-01-31T23:00:00.000Z');
  });

  it('febrero bisiesto y no bisiesto', () => {
    expect(iso(periodoMensual(new Date('2028-02-10T12:00:00Z'), 'UTC').fin)).toBe('2028-03-01T00:00:00.000Z');
    const p = periodoMensual(new Date('2027-02-28T12:00:00Z'), 'UTC');
    expect(p.clave).toBe('2027-02');
    expect(iso(p.fin)).toBe('2027-03-01T00:00:00.000Z');
  });

  it('medianoche que no existe: el mes empieza en el instante del salto de reloj', () => {
    // Cairo 2014: el 01/08 a las 00:00 el reloj saltó a las 01:00 (DST). El mes arranca en ese salto.
    const p = periodoMensual(new Date('2014-08-10T12:00:00Z'), 'Africa/Cairo');
    expect(p.clave).toBe('2014-08');
    expect(iso(p.inicio)).toBe('2014-07-31T22:00:00.000Z');
    expect(periodoMensual(new Date(p.inicio.getTime() - 1), 'Africa/Cairo').clave).toBe('2014-07');
  });

  it('zona inválida lanza', () => {
    expect(() => periodoMensual(new Date(), 'Mars/Olympus')).toThrow();
  });
});

describe('esZonaValida', () => {
  it('acepta IANA reales', () => {
    for (const z of ['Europe/Madrid', 'Atlantic/Canary', 'America/Argentina/Buenos_Aires', 'America/Mexico_City', 'UTC']) {
      expect(esZonaValida(z)).toBe(true);
    }
  });
  it('rechaza basura, vacíos, offsets y tipos incorrectos', () => {
    for (const z of ['', 'Mars/Olympus', 'madrid', '+01:00', 'Europe/Madrid; drop', 'x'.repeat(100), 5, null, undefined, {}]) {
      expect(esZonaValida(z)).toBe(false);
    }
  });
  it('la zona por defecto es válida', () => {
    expect(ZONA_POR_DEFECTO).toBe('Europe/Madrid');
    expect(esZonaValida(ZONA_POR_DEFECTO)).toBe(true);
  });
});

describe('zonaDeEmpresa', () => {
  it('usa zonaHoraria si es válida; si no (legada, vacía, corrupta) Europe/Madrid', () => {
    expect(zonaDeEmpresa({ zonaHoraria: 'America/Lima' })).toBe('America/Lima');
    expect(zonaDeEmpresa({})).toBe('Europe/Madrid');
    expect(zonaDeEmpresa(undefined)).toBe('Europe/Madrid');
    expect(zonaDeEmpresa({ zonaHoraria: 'basura' })).toBe('Europe/Madrid');
  });
});
