import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Schema } from 'firebase/ai';
import { AgentToolRegistry } from './agent-tool-registry';
import { PermissionService } from '../services/permission.service';
import { toolOk, type AgentTool } from './agent-tool';

/** Tool de juguete: registra si la ejecutaron, para probar que el guardia corta ANTES. */
function fakeTool(over: Partial<AgentTool> = {}): AgentTool & { execute: ReturnType<typeof vi.fn> } {
  return {
    name: 'buscar_casos',
    description: 'Busca casos por nombre',
    parameters: Schema.object({ properties: { consulta: Schema.string() } }),
    execute: vi.fn(async () => toolOk({ resultados: [] })),
    ...over,
  } as AgentTool & { execute: ReturnType<typeof vi.fn> };
}

/** `can` configurable: por defecto concede todo. */
function setup(can: (modulo: string, cap: string) => boolean = () => true) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      AgentToolRegistry,
      {
        provide: PermissionService,
        useValue: {
          can: vi.fn(can),
          denyMessage: (m: string, c: string) => `No tienes permiso para ${c} ${m}.`,
        },
      },
    ],
  });
  return TestBed.inject(AgentToolRegistry);
}

describe('AgentToolRegistry — registro', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('expone las tools registradas como declaraciones para el modelo', () => {
    const registry = setup();
    registry.register(fakeTool());
    const [decl] = registry.declarations();
    expect(decl.name).toBe('buscar_casos');
    expect(decl.description).toBe('Busca casos por nombre');
    expect(decl.parameters).toBeDefined();
  });

  it('rechaza nombres duplicados — un choque silencioso sería un bug imposible de ver', () => {
    const registry = setup();
    registry.register(fakeTool());
    expect(() => registry.register(fakeTool())).toThrow(/buscar_casos/);
  });

  it('registra varias tools de una vez', () => {
    const registry = setup();
    registry.registerAll([fakeTool(), fakeTool({ name: 'abrir_caso' })]);
    expect(registry.declarations().map((d) => d.name)).toEqual(['buscar_casos', 'abrir_caso']);
  });
});

describe('AgentToolRegistry — permisos', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('OCULTA al modelo las tools que el usuario no puede usar', () => {
    const registry = setup((_m, cap) => cap === 'ver');
    registry.registerAll([
      fakeTool({ permission: { modulo: 'Casos', cap: 'ver' } }),
      fakeTool({ name: 'crear_caso', permission: { modulo: 'Casos', cap: 'crear' } }),
    ]);
    expect(registry.declarations().map((d) => d.name)).toEqual(['buscar_casos']);
  });

  it('en modo solo-lectura esconde todo lo que no sea "ver"', () => {
    const registry = setup();
    registry.registerAll([
      fakeTool({ permission: { modulo: 'Casos', cap: 'ver' } }),
      fakeTool({ name: 'crear_caso', permission: { modulo: 'Casos', cap: 'crear' } }),
      fakeTool({ name: 'navegar', permission: undefined }),
    ]);
    expect(registry.declarations({ soloLectura: true }).map((d) => d.name)).toEqual([
      'buscar_casos',
      'navegar',
    ]);
  });

  it('una tool sin permiso declarado está siempre disponible', () => {
    const registry = setup(() => false);
    registry.register(fakeTool({ name: 'navegar', permission: undefined }));
    expect(registry.declarations()).toHaveLength(1);
  });

  it('revalida el permiso al ejecutar y NO llama a execute', async () => {
    const registry = setup(() => false);
    const tool = fakeTool({ permission: { modulo: 'Casos', cap: 'crear' } });
    registry.register(tool);

    const result = await registry.run('buscar_casos', {});

    expect(result.ok).toBe(false);
    expect(result.data['error']).toContain('No tienes permiso');
    expect(tool.execute).not.toHaveBeenCalled();
  });
});

describe('AgentToolRegistry — ejecución', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('ejecuta la tool y devuelve su resultado', async () => {
    const registry = setup();
    registry.register(fakeTool({ execute: vi.fn(async () => toolOk({ total: 3 })) }));
    const result = await registry.run('buscar_casos', { consulta: 'villa' });
    expect(result).toEqual({ ok: true, data: { total: 3 }, display: undefined });
  });

  it('pasa los argumentos tal cual a la tool', async () => {
    const registry = setup();
    const tool = fakeTool();
    registry.register(tool);
    await registry.run('buscar_casos', { consulta: 'villa garrapata' });
    expect(tool.execute).toHaveBeenCalledWith({ consulta: 'villa garrapata' });
  });

  it('una tool inexistente devuelve error legible en vez de reventar', async () => {
    const registry = setup();
    const result = await registry.run('tool_inventada', {});
    expect(result.ok).toBe(false);
    expect(result.data['error']).toContain('tool_inventada');
  });

  it('si la tool lanza, el error se convierte en resultado — el modelo debe poder leerlo', async () => {
    const registry = setup();
    registry.register(
      fakeTool({
        execute: vi.fn(async () => {
          throw new Error('Firestore caído');
        }),
      }),
    );
    const result = await registry.run('buscar_casos', {});
    expect(result.ok).toBe(false);
    expect(result.data['error']).toContain('Firestore caído');
  });
});
