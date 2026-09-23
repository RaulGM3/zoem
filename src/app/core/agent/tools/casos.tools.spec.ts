import { describe, it, expect, vi, beforeEach } from 'vitest';
import { casosTools } from './casos.tools';
import type { AgentTool } from '../agent-tool';
import type { Caso } from '../../../interfaces/caso.interface';

function caso(over: Partial<Caso> = {}): Caso {
  return {
    id: 'c-1',
    companyId: 'emp-1',
    titulo: 'Villa Garrapata S.L. — reclamación',
    tipo: 'Civil',
    estado: 'en_proceso',
    prioridad: 'alta',
    ...over,
  } as Caso;
}

function setup(casos: Caso[] = [caso()]) {
  const navigate = vi.fn(async () => true);
  const tools = casosTools({ casos: () => casos, navegador: { navigate } });
  const byName = (n: string) => tools.find((t) => t.name === n) as AgentTool;
  return { tools, navigate, byName };
}

describe('buscar_casos', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => (ctx = setup()));

  it('exige permiso de lectura en Casos', () => {
    expect(ctx.byName('buscar_casos').permission).toEqual({ modulo: 'Casos', cap: 'ver' });
  });

  it('devuelve id, título, estado y tipo — lo justo para que el modelo decida', async () => {
    const r = await ctx.byName('buscar_casos').execute({ consulta: 'garrapata' });
    expect(r.ok).toBe(true);
    expect(r.data['resultados']).toEqual([
      { id: 'c-1', titulo: 'Villa Garrapata S.L. — reclamación', estado: 'en_proceso', tipo: 'Civil' },
    ]);
  });

  it('filtra por estado además de por texto', async () => {
    const { byName } = setup([
      caso({ id: 'c-1', estado: 'cerrado' }),
      caso({ id: 'c-2', estado: 'urgente' }),
    ]);
    const r = await byName('buscar_casos').execute({ consulta: 'garrapata', estado: 'urgente' });
    expect((r.data['resultados'] as { id: string }[]).map((c) => c.id)).toEqual(['c-2']);
  });

  it('rechaza un estado inexistente diciendo cuáles valen — así el modelo reintenta bien', async () => {
    const r = await ctx.byName('buscar_casos').execute({ consulta: 'x', estado: 'pendiente_de_algo' });
    expect(r.ok).toBe(false);
    expect(r.data['error']).toContain('en_proceso');
  });

  it('sin coincidencias devuelve lista vacía, no un error', async () => {
    const r = await ctx.byName('buscar_casos').execute({ consulta: 'concurso de acreedores' });
    expect(r.ok).toBe(true);
    expect(r.data['resultados']).toEqual([]);
  });

  it('sin consulta lista los casos disponibles en vez de fallar', async () => {
    const r = await ctx.byName('buscar_casos').execute({});
    expect((r.data['resultados'] as unknown[]).length).toBe(1);
  });
});

describe('abrir_caso', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => (ctx = setup()));

  it('navega al detalle del caso', async () => {
    const r = await ctx.byName('abrir_caso').execute({ casoId: 'c-1' });
    expect(r.ok).toBe(true);
    expect(ctx.navigate).toHaveBeenCalledWith(['/casos', 'c-1']);
  });

  it('NO navega a un id que el modelo se haya inventado', async () => {
    const r = await ctx.byName('abrir_caso').execute({ casoId: 'c-inventado' });
    expect(r.ok).toBe(false);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });
});

describe('crear_caso', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => (ctx = setup()));

  it('exige permiso de creación', () => {
    expect(ctx.byName('crear_caso').permission).toEqual({ modulo: 'Casos', cap: 'crear' });
  });

  it('abre el formulario precargado SIN escribir nada', async () => {
    const r = await ctx.byName('crear_caso').execute({
      titulo: 'Desahucio Pérez',
      descripcion: 'Impago de tres mensualidades',
      tipo: 'Civil',
      prioridad: 'alta',
    });

    expect(r.ok).toBe(true);
    expect(ctx.navigate).toHaveBeenCalledWith(['/casos'], {
      queryParams: { newCaso: '1' },
      state: {
        titulo: 'Desahucio Pérez',
        descripcion: 'Impago de tres mensualidades',
        tipo: 'Civil',
        prioridad: 'alta',
      },
    });
  });

  it('avisa al modelo de que NO ha guardado, para que no se lo diga al usuario', async () => {
    const r = await ctx.byName('crear_caso').execute({ titulo: 'X' });
    expect(String(r.data['aviso'])).toMatch(/no se ha guardado/i);
  });

  it('pasa el contacto como queryParam, que es lo que la página espera', async () => {
    const r = await ctx.byName('crear_caso').execute({ titulo: 'X', contactoId: 'ct-9' });
    expect(r.ok).toBe(true);
    expect(ctx.navigate).toHaveBeenCalledWith(
      ['/casos'],
      expect.objectContaining({ queryParams: { newCaso: '1', contactId: 'ct-9' } }),
    );
  });

  it('sin título falla: es el único campo que el formulario no puede adivinar', async () => {
    const r = await ctx.byName('crear_caso').execute({ descripcion: 'algo' });
    expect(r.ok).toBe(false);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('rechaza un tipo fuera del catálogo en vez de colarlo en el formulario', async () => {
    const r = await ctx.byName('crear_caso').execute({ titulo: 'X', tipo: 'Penal' });
    expect(r.ok).toBe(false);
    expect(r.data['error']).toContain('Mercantil');
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('omite del state los campos que el usuario no dictó', async () => {
    await ctx.byName('crear_caso').execute({ titulo: 'Solo título' });
    expect(ctx.navigate).toHaveBeenCalledWith(['/casos'], {
      queryParams: { newCaso: '1' },
      state: { titulo: 'Solo título' },
    });
  });
});
