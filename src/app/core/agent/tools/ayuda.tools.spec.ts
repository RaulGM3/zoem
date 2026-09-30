import { describe, it, expect, vi } from 'vitest';
import { ayudaTools } from './ayuda.tools';
import type { Guia, PuedeFn, TareaGuia } from '../../ayuda/guia';
import type { AgentTool } from '../agent-tool';

function tarea(p: Partial<TareaGuia> = {}): TareaGuia {
  return { id: 'tarea', titulo: 'Tarea', pasos: ['Paso'], claves: [], ...p };
}

const CASOS: Guia = {
  id: 'casos',
  titulo: 'Casos',
  modulo: 'Casos',
  ruta: '/casos',
  resumen: 'Expedientes del despacho.',
  paraQue: 'Seguir cada asunto.',
  claves: [],
  tareas: [
    tarea({ id: 'buscar-caso', titulo: 'Buscar un caso', pasos: ['Usa los filtros.'] }),
    tarea({
      id: 'crear-caso',
      titulo: 'Crear un caso nuevo',
      pasos: ['Pulsa "Nuevo caso".', 'Pulsa "Crear caso".'],
      requiere: { modulo: 'Casos', capacidad: 'crear' },
    }),
  ],
};

const TESORERIA: Guia = {
  id: 'tesoreria',
  titulo: 'Tesorería',
  modulo: 'Tesorería',
  ruta: '/tesoreria',
  resumen: 'Cuentas y movimientos.',
  paraQue: 'Saber cuánto dinero hay.',
  claves: [],
  tareas: [tarea({ id: 'cierre', titulo: 'Hacer un cierre de caja', pasos: ['Pulsa "Cierre de caja".'] })],
};

const GENERAL: Guia = {
  id: 'general',
  titulo: 'Primeros pasos',
  modulo: null,
  ruta: '/',
  resumen: 'Cómo moverte.',
  paraQue: 'Orientarte.',
  claves: [],
  tareas: [tarea({ id: 'menu', titulo: 'Moverte por el menú', pasos: ['Pulsa una entrada.'] })],
};

const TODO: PuedeFn = () => true;

function setup(puede: PuedeFn = TODO, guias: readonly Guia[] = [GENERAL, CASOS, TESORERIA]) {
  const cargar = vi.fn(async () => guias);
  const [consultar] = ayudaTools({ cargar, puede }) as AgentTool[];
  return { cargar, consultar };
}

/** Atajo para leer los resultados tipados de la respuesta de la tool. */
function resultados(data: Record<string, unknown>): { guia: string; ruta: string; texto: string }[] {
  return data['resultados'] as { guia: string; ruta: string; texto: string }[];
}

describe('consultar_ayuda', () => {
  it('se llama consultar_ayuda y no declara permiso fijo: se autocontrola por contenido', () => {
    const { consultar } = setup();
    expect(consultar.name).toBe('consultar_ayuda');
    expect(consultar.permission).toBeUndefined();
  });

  it('no carga las guías hasta que se ejecuta: el contenido es diferido', async () => {
    const { cargar, consultar } = setup();
    expect(cargar).not.toHaveBeenCalled();
    await consultar.execute({ consulta: 'caso' });
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('devuelve los pasos de la tarea que coincide, con la ruta de su pantalla', async () => {
    const { consultar } = setup();
    const r = await consultar.execute({ consulta: 'crear caso' });
    expect(r.ok).toBe(true);
    const [primero] = resultados(r.data);
    expect(primero.guia).toBe('casos');
    expect(primero.ruta).toBe('/casos');
    expect(primero.texto).toContain('Tarea: Crear un caso nuevo');
    expect(primero.texto).toContain('1. Pulsa "Nuevo caso".');
    expect(primero.texto).not.toContain('Buscar un caso');
  });

  it('no enseña una guía de un módulo que el usuario no puede ver', async () => {
    const { consultar } = setup((m) => m !== 'Tesorería');
    const r = await consultar.execute({ consulta: 'cierre de caja' });
    expect(r.ok).toBe(false);
    expect(r.data['error']).toContain('no tiene acceso');
    expect(JSON.stringify(r.data)).not.toContain('Pulsa "Cierre de caja"');
  });

  it('no enseña una tarea que el usuario no puede ejecutar', async () => {
    const { consultar } = setup((_m, cap) => cap === 'ver');
    const r = await consultar.execute({ consulta: 'crear caso nuevo' });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r.data)).not.toContain('Pulsa "Nuevo caso"');
  });

  it('sin coincidencias responde ok con lista vacía y ordena no improvisar', async () => {
    const { consultar } = setup();
    const r = await consultar.execute({ consulta: 'nóminas' });
    expect(r.ok).toBe(true);
    expect(resultados(r.data)).toEqual([]);
    expect(String(r.data['aviso'])).toMatch(/no improvises|NO improvises/i);
  });

  it('devuelve como máximo 3 guías', async () => {
    const muchas = (['general', 'casos', 'tesoreria', 'contactos', 'documentos'] as const).map((id) => ({
      ...GENERAL,
      id,
      titulo: `Guía ${id}`,
      tareas: [tarea({ titulo: 'Exportar datos' })],
    }));
    const { consultar } = setup(TODO, muchas);
    const r = await consultar.execute({ consulta: 'exportar' });
    expect(resultados(r.data)).toHaveLength(3);
  });

  it('con `guia` y sin consulta devuelve esa guía entera', async () => {
    const { consultar } = setup();
    const r = await consultar.execute({ guia: 'casos' });
    expect(r.ok).toBe(true);
    const lista = resultados(r.data);
    expect(lista).toHaveLength(1);
    expect(lista[0].texto).toContain('Buscar un caso');
    expect(lista[0].texto).toContain('Crear un caso nuevo');
  });

  it('con `guia` acota la búsqueda a esa guía', async () => {
    const { consultar } = setup();
    const r = await consultar.execute({ consulta: 'cierre', guia: 'casos' });
    expect(resultados(r.data)).toEqual([]);
  });

  it('una `guia` que el usuario no puede ver falla sin filtrar contenido', async () => {
    const { consultar } = setup((m) => m !== 'Tesorería');
    const r = await consultar.execute({ guia: 'tesoreria' });
    expect(r.ok).toBe(false);
    expect(r.data['error']).toContain('no tiene acceso');
    expect(JSON.stringify(r.data)).not.toContain('Cierre de caja');
  });

  it('una `guia` inexistente devuelve el catálogo válido, no un fallo mudo', async () => {
    const { consultar } = setup();
    const r = await consultar.execute({ consulta: 'algo', guia: 'marketing' });
    expect(r.ok).toBe(false);
    expect(r.data['error']).toContain('casos');
  });

  it('sin consulta ni guía devuelve el índice de guías visibles, sin pasos', async () => {
    const { consultar } = setup((m) => m !== 'Tesorería');
    const r = await consultar.execute({});
    expect(r.ok).toBe(true);
    const indice = r.data['guias'] as { guia: string; titulo: string }[];
    expect(indice.map((g) => g.guia)).toEqual(['general', 'casos']);
    expect(JSON.stringify(r.data)).not.toContain('Tarea:');
  });
});
