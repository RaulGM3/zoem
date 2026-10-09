import { describe, expect, it } from 'vitest';
import { textosBloqueo } from './textos-bloqueo';

const ahora = new Date('2026-10-09T12:00:00Z');
const base = { plan: 'free' as const, ahora, zona: 'Europe/Madrid' };

describe('textosBloqueo', () => {
  it('casos: "Has usado tus N casos del plan Free"', () => {
    const t = textosBloqueo({ tipo: 'cupo', recurso: 'casosActivos', usado: 50, limite: 50 }, base);
    expect(t.titulo).toBe('Has usado tus 50 casos del plan Free');
    expect(t.cta).toBe('Hazte PRO');
    expect(t.ctaSecundaria).toBe('Ahora no');
  });
  it('acciones: indica cuándo se renuevan según la zona horaria de la empresa', () => {
    const t = textosBloqueo({ tipo: 'cupo', recurso: 'accionesMes', usado: 15, limite: 15 }, base);
    expect(t.titulo).toBe('Se acabaron tus 15 acciones de este mes (se renuevan el 1 de noviembre según tu zona horaria)');
  });
  it('la fecha de renovación respeta la zona (31/10 23:30 UTC ya es noviembre en Madrid, pero no en Bogotá)', () => {
    const t = textosBloqueo({ tipo: 'cupo', recurso: 'iaMensajesMes', usado: 30, limite: 30 }, { ...base, ahora: new Date('2026-10-31T23:30:00Z') });
    expect(t.titulo).toBe('Se acabaron tus 30 mensajes de IA de este mes (se renuevan el 1 de diciembre según tu zona horaria)');
    const bogota = textosBloqueo({ tipo: 'cupo', recurso: 'iaMensajesMes', usado: 30, limite: 30 }, { ...base, ahora: new Date('2026-10-31T23:30:00Z'), zona: 'America/Bogota' });
    expect(bogota.titulo).toContain('1 de noviembre');
  });
  it('resto de cupos', () => {
    expect(textosBloqueo({ tipo: 'cupo', recurso: 'contactos', usado: 10, limite: 10 }, { ...base, plan: 'demo' }).titulo).toBe('Has usado tus 10 contactos del plan Demo');
    expect(textosBloqueo({ tipo: 'cupo', recurso: 'plantillas', usado: 5, limite: 5 }, base).titulo).toBe('Has usado tus 5 plantillas del plan Free');
    expect(textosBloqueo({ tipo: 'cupo', recurso: 'usuarios', usado: 1, limite: 1 }, base).titulo).toBe('Tu plan Free incluye 1 usuario');
    expect(textosBloqueo({ tipo: 'cupo', recurso: 'usuarios', usado: 3, limite: 3 }, base).titulo).toBe('Has usado tus 3 usuarios del plan Free');
    expect(textosBloqueo({ tipo: 'cupo', recurso: 'documentosMB', usado: 500, limite: 500 }, base).titulo).toBe('Has llenado tus 500 MB de documentos del plan Free');
    expect(textosBloqueo({ tipo: 'cupo', recurso: 'documentosMB', usado: 20000, limite: 20000 }, { ...base, plan: 'pro' }).titulo).toBe('Has llenado tus 20 GB de documentos del plan Pro');
  });
  it('función: "Esta función está en el plan Pro" con la descripción de la función', () => {
    const t = textosBloqueo({ tipo: 'funcion', recurso: 'tesoreria' }, base);
    expect(t.titulo).toBe('Esta función está en el plan Pro');
    expect(t.descripcion).toMatch(/cobros|saldo/i);
  });
  it('demo terminada', () => {
    const t = textosBloqueo({ tipo: 'demoTerminada', recurso: 'demo' }, { ...base, plan: 'demo' });
    expect(t.titulo).toBe('Tu despacho de ejemplo terminó');
    expect(t.descripcion).toMatch(/conserv/i);
  });
});
