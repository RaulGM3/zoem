import { describe, it, expect } from 'vitest';
import {
  construirPromptRedaccion, contextoParaIa, formatoParaCanales, normalizarRedaccion,
} from './redaccion-ia';

const CTX = {
  cliente: 'Ana Ruiz', nombre: 'Ana Ruiz', contacto: 'Ana Ruiz', email: 'ana@x.com', telefono: '612345678',
  caso: 'Divorcio', asunto: 'Divorcio', tipo: 'Civil', descripcion: '', vencimiento: '01/12/2026',
  hito: 'Vista', hito_descripcion: '', empresa: 'Despacho Pérez', fecha: '06/10/2026', hoy: '06/10/2026',
};

describe('formatoParaCanales', () => {
  it('whatsapp solo si TODOS los canales son WhatsApp', () => {
    expect(formatoParaCanales(['whatsapp'])).toBe('whatsapp');
    expect(formatoParaCanales(['gmail', 'whatsapp'])).toBe('email');
    expect(formatoParaCanales(['outlook'])).toBe('email');
  });

  it('sin canales elegidos usa email', () => {
    expect(formatoParaCanales([])).toBe('email');
  });
});

describe('contextoParaIa (minimización de datos)', () => {
  it('nunca envía email ni teléfono y descarta claves vacías y duplicadas', () => {
    const r = contextoParaIa(CTX);
    expect(r).not.toHaveProperty('email');
    expect(r).not.toHaveProperty('telefono');
    expect(r).not.toHaveProperty('descripcion');
    expect(r).not.toHaveProperty('nombre');
    expect(r).not.toHaveProperty('hoy');
    expect(r).toMatchObject({ cliente: 'Ana Ruiz', caso: 'Divorcio', hito: 'Vista', empresa: 'Despacho Pérez' });
  });
});

describe('construirPromptRedaccion', () => {
  it('modo plantilla: lista las variables y no incluye datos reales', () => {
    const p = construirPromptRedaccion({ modo: 'plantilla', formato: 'email', instrucciones: 'pedir el DNI' });
    expect(p).toContain('pedir el DNI');
    expect(p).toContain('{{cliente}}');
    expect(p).toContain('{{hito}}');
    expect(p).not.toContain('Ana Ruiz');
  });

  it('modo mensaje: incluye el contexto minimizado y el borrador', () => {
    const p = construirPromptRedaccion({
      modo: 'mensaje', formato: 'email', instrucciones: 'recordar la vista',
      contexto: CTX, borrador: { asunto: 'Novedad', cuerpo: 'Hola Ana' },
    });
    expect(p).toContain('recordar la vista');
    expect(p).toContain('Ana Ruiz');
    expect(p).toContain('Hola Ana');
    expect(p).not.toContain('ana@x.com');
    expect(p).not.toContain('612345678');
  });

  it('el formato WhatsApp pide un mensaje breve y distinto del de email', () => {
    const wa = construirPromptRedaccion({ modo: 'plantilla', formato: 'whatsapp', instrucciones: 'x' });
    const em = construirPromptRedaccion({ modo: 'plantilla', formato: 'email', instrucciones: 'x' });
    expect(wa).toMatch(/WhatsApp/);
    expect(wa).not.toBe(em);
  });

  it('no envía un borrador vacío', () => {
    const p = construirPromptRedaccion({
      modo: 'plantilla', formato: 'email', instrucciones: 'x', borrador: { asunto: ' ', cuerpo: '' },
    });
    expect(p).not.toMatch(/Borrador actual/);
  });
});

describe('normalizarRedaccion', () => {
  it('recorta y devuelve asunto y cuerpo', () => {
    expect(normalizarRedaccion({ asunto: ' Hola ', cuerpo: ' Texto \n' })).toEqual({ asunto: 'Hola', cuerpo: 'Texto' });
  });

  it('null si falta el cuerpo o no es un objeto', () => {
    expect(normalizarRedaccion({ asunto: 'A', cuerpo: '  ' })).toBeNull();
    expect(normalizarRedaccion('texto')).toBeNull();
    expect(normalizarRedaccion(null)).toBeNull();
  });

  it('asunto ausente se devuelve vacío', () => {
    expect(normalizarRedaccion({ cuerpo: 'Texto' })).toEqual({ asunto: '', cuerpo: 'Texto' });
  });
});
