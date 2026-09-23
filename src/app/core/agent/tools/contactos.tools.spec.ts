import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contactosTools } from './contactos.tools';
import type { AgentTool } from '../agent-tool';
import type { Contact } from '../../../interfaces/contact.interface';

const fisica = (over: Partial<Contact> = {}): Contact =>
  ({
    id: 'ct-1',
    companyId: 'emp-1',
    type: 'persona_fisica',
    nombre: 'Ana',
    apellidos: 'Martínez',
    status: 'activo',
    ...over,
  }) as Contact;

const juridica = (over: Partial<Contact> = {}): Contact =>
  ({
    id: 'ct-2',
    companyId: 'emp-1',
    type: 'persona_juridica',
    razonSocial: 'Villa Garrapata S.L.',
    status: 'activo',
    ...over,
  }) as Contact;

function setup(contactos: Contact[] = [fisica(), juridica()]) {
  const navigate = vi.fn(async () => true);
  const tools = contactosTools({ contactos: () => contactos, navegador: { navigate } });
  return { navigate, byName: (n: string) => tools.find((t) => t.name === n) as AgentTool };
}

describe('buscar_contactos', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => (ctx = setup()));

  it('encuentra personas físicas por nombre y apellidos', async () => {
    const r = await ctx.byName('buscar_contactos').execute({ consulta: 'ana martinez' });
    expect(r.data['resultados']).toEqual([{ id: 'ct-1', nombre: 'Ana Martínez', status: 'activo' }]);
  });

  it('encuentra personas jurídicas por razón social', async () => {
    const r = await ctx.byName('buscar_contactos').execute({ consulta: 'garrapata' });
    expect((r.data['resultados'] as { id: string }[])[0].id).toBe('ct-2');
  });

  it('sin coincidencias devuelve lista vacía, no un error', async () => {
    const r = await ctx.byName('buscar_contactos').execute({ consulta: 'zzzz' });
    expect(r.ok).toBe(true);
    expect(r.data['resultados']).toEqual([]);
  });
});

describe('abrir_contacto', () => {
  it('navega a la ficha del contacto', async () => {
    const ctx = setup();
    await ctx.byName('abrir_contacto').execute({ contactoId: 'ct-2' });
    expect(ctx.navigate).toHaveBeenCalledWith(['/contactos', 'ct-2']);
  });

  it('NO navega a un id inventado', async () => {
    const ctx = setup();
    const r = await ctx.byName('abrir_contacto').execute({ contactoId: 'ct-99' });
    expect(r.ok).toBe(false);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });
});

describe('crear_contacto', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => (ctx = setup()));

  it('exige permiso de creación en Contactos', () => {
    expect(ctx.byName('crear_contacto').permission).toEqual({ modulo: 'Contactos', cap: 'crear' });
  });

  it('manda los datos personales por state y NUNCA por la URL', async () => {
    const r = await ctx.byName('crear_contacto').execute({
      nombre: 'Ana',
      apellidos: 'Pérez',
      mobile: '600111222',
      notes: 'Viene de la llamada del martes',
    });

    expect(r.ok).toBe(true);
    expect(ctx.navigate).toHaveBeenCalledWith(['/contactos'], {
      queryParams: { newContact: '1' },
      state: {
        nombre: 'Ana',
        apellidos: 'Pérez',
        mobile: '600111222',
        notes: 'Viene de la llamada del martes',
      },
    });
  });

  it('avisa al modelo de que no ha guardado nada', async () => {
    const r = await ctx.byName('crear_contacto').execute({ nombre: 'Ana' });
    expect(String(r.data['aviso'])).toMatch(/no se ha guardado/i);
  });

  it('sin nombre falla y no navega', async () => {
    const r = await ctx.byName('crear_contacto').execute({ apellidos: 'Pérez' });
    expect(r.ok).toBe(false);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });
});
