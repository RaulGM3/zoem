import { describe, it, expect } from 'vitest';
import { construirContextoAccion } from './contexto-accion';
import type { Contact } from '../../interfaces/contact.interface';
import type { Caso, Hito } from '../../interfaces/caso.interface';

const ana = {
  id: '1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'Ruiz',
  email: 'ana@x.com', mobile: '612345678', phone: '910000000', asunto: 'Herencia',
} as Contact;
const acme = {
  id: '2', type: 'persona_juridica', razonSocial: 'Acme SL', email: 'info@acme.com', phone: '910000001',
} as Contact;
const caso = { id: 'c1', titulo: 'Divorcio Ruiz', tipo: 'Civil', descripcion: 'Desc', vencimiento: '2026-12-31' } as Caso;
const hito = { id: 'h1', titulo: 'Demanda presentada', descripcion: 'Se presentó' } as Hito;
const hoy = new Date(2026, 9, 5);

describe('construirContextoAccion', () => {
  it('un contacto', () => {
    const ctx = construirContextoAccion({ contactos: [ana], empresa: 'Zoem', hoy });
    expect(ctx['cliente']).toBe('Ana Ruiz');
    expect(ctx['nombre']).toBe('Ana Ruiz');
    expect(ctx['email']).toBe('ana@x.com');
    expect(ctx['telefono']).toBe('612345678');
    expect(ctx['asunto']).toBe('Herencia');
    expect(ctx['empresa']).toBe('Zoem');
  });

  it('teléfono: móvil, con fallback al fijo', () => {
    expect(construirContextoAccion({ contactos: [acme], empresa: '', hoy })['telefono']).toBe('910000001');
  });

  it('varios destinatarios: cliente unido, email unidos por coma', () => {
    const ctx = construirContextoAccion({ contactos: [ana, acme], empresa: '', hoy });
    expect(ctx['cliente']).toBe('Ana Ruiz, Acme SL');
    expect(ctx['email']).toBe('ana@x.com, info@acme.com');
  });

  it('caso e hito', () => {
    const ctx = construirContextoAccion({ contactos: [ana], caso, hito, empresa: '', hoy });
    expect(ctx['caso']).toBe('Divorcio Ruiz');
    expect(ctx['asunto']).toBe('Divorcio Ruiz');
    expect(ctx['tipo']).toBe('Civil');
    expect(ctx['hito']).toBe('Demanda presentada');
    expect(ctx['hito_descripcion']).toBe('Se presentó');
    expect(ctx['vencimiento']).toBe('31/12/2026');
  });

  it('fecha y hoy en es-ES sin usar new Date implícito', () => {
    const ctx = construirContextoAccion({ contactos: [], empresa: '', hoy });
    expect(ctx['fecha']).toBe('05/10/2026');
    expect(ctx['hoy']).toBe('05/10/2026');
  });

  it('sin caso/hito deja las claves vacías (existen para detectar faltantes)', () => {
    const ctx = construirContextoAccion({ contactos: [ana], empresa: '', hoy });
    expect(ctx['caso']).toBe('');
    expect(ctx['hito']).toBe('');
    expect(ctx['hito_descripcion']).toBe('');
  });

  it('sin contactos: cliente vacío', () => {
    expect(construirContextoAccion({ contactos: [], empresa: '', hoy })['cliente']).toBe('');
  });
});
