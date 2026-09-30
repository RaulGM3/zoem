import { describe, it, expect } from 'vitest';
import type { Capability, Modulo } from '../permissions/permissions';
import type { Guia, PuedeFn, TareaGuia } from './guia';
import { guiaPorId, guiasVisibles } from './filtro-guias';

function tarea(p: Partial<TareaGuia> = {}): TareaGuia {
  return { id: 'tarea', titulo: 'Tarea', pasos: ['Paso'], claves: [], ...p };
}

function guia(p: Partial<Guia> = {}): Guia {
  return {
    id: 'casos',
    titulo: 'Casos',
    modulo: 'Casos',
    ruta: '/casos',
    resumen: 'Resumen',
    paraQue: 'Para qué',
    tareas: [tarea()],
    claves: [],
    ...p,
  };
}

/** Doble de permisos: concede solo los pares `Modulo:capacidad` listados. */
function puedeSolo(...permitidos: `${Modulo}:${Capability}`[]): PuedeFn {
  return (modulo, capacidad) => permitidos.includes(`${modulo}:${capacidad}`);
}

const NADA: PuedeFn = () => false;

describe('guiasVisibles', () => {
  it('las guías generales se ven siempre, aunque no haya ningún permiso', () => {
    const general = guia({ id: 'general', modulo: null });
    expect(guiasVisibles([general], NADA)).toEqual([general]);
  });

  it('oculta la guía de un módulo que el usuario no puede ver', () => {
    const guias = [guia({ id: 'casos', modulo: 'Casos' }), guia({ id: 'tesoreria', modulo: 'Tesorería' })];
    const out = guiasVisibles(guias, puedeSolo('Casos:ver'));
    expect(out.map(g => g.id)).toEqual(['casos']);
  });

  it('quita las tareas cuyo requisito no se cumple', () => {
    const g = guia({
      tareas: [
        tarea({ id: 'consultar' }),
        tarea({ id: 'crear', requiere: { modulo: 'Casos', capacidad: 'crear' } }),
      ],
    });
    const [out] = guiasVisibles([g], puedeSolo('Casos:ver'));
    expect(out.tareas.map(t => t.id)).toEqual(['consultar']);
  });

  it('conserva las tareas cuyo requisito sí se cumple', () => {
    const g = guia({ tareas: [tarea({ id: 'crear', requiere: { modulo: 'Casos', capacidad: 'crear' } })] });
    const [out] = guiasVisibles([g], puedeSolo('Casos:ver', 'Casos:crear'));
    expect(out.tareas.map(t => t.id)).toEqual(['crear']);
  });

  it('el requisito puede ser de un módulo distinto al de la guía', () => {
    const g = guia({
      tareas: [
        tarea({ id: 'consultar' }),
        tarea({ id: 'plantillas', requiere: { modulo: 'Configuración', capacidad: 'ver' } }),
      ],
    });
    const sinConfig = guiasVisibles([g], puedeSolo('Casos:ver'));
    const conConfig = guiasVisibles([g], puedeSolo('Casos:ver', 'Configuración:ver'));
    expect(sinConfig[0].tareas.map(t => t.id)).toEqual(['consultar']);
    expect(conConfig[0].tareas.map(t => t.id)).toEqual(['consultar', 'plantillas']);
  });

  it('también filtra las tareas de las guías generales', () => {
    const general = guia({
      id: 'general',
      modulo: null,
      tareas: [tarea({ id: 'libre' }), tarea({ id: 'invitar', requiere: { modulo: 'Configuración', capacidad: 'crear' } })],
    });
    const [out] = guiasVisibles([general], NADA);
    expect(out.tareas.map(t => t.id)).toEqual(['libre']);
  });

  it('una guía que se queda sin tareas sigue visible con su resumen', () => {
    const g = guia({ tareas: [tarea({ requiere: { modulo: 'Casos', capacidad: 'crear' } })] });
    const out = guiasVisibles([g], puedeSolo('Casos:ver'));
    expect(out).toHaveLength(1);
    expect(out[0].tareas).toEqual([]);
    expect(out[0].resumen).toBe('Resumen');
  });

  it('no muta las guías de entrada', () => {
    const g = guia({ tareas: [tarea({ requiere: { modulo: 'Casos', capacidad: 'crear' } })] });
    guiasVisibles([g], puedeSolo('Casos:ver'));
    expect(g.tareas).toHaveLength(1);
  });

  it('respeta el orden de entrada', () => {
    const guias = [
      guia({ id: 'tesoreria', modulo: 'Tesorería' }),
      guia({ id: 'general', modulo: null }),
      guia({ id: 'casos', modulo: 'Casos' }),
    ];
    const out = guiasVisibles(guias, puedeSolo('Casos:ver', 'Tesorería:ver'));
    expect(out.map(g => g.id)).toEqual(['tesoreria', 'general', 'casos']);
  });
});

describe('guiaPorId', () => {
  it('encuentra la guía por su id', () => {
    const guias = [guia({ id: 'casos' }), guia({ id: 'contactos' })];
    expect(guiaPorId(guias, 'contactos')).toBe(guias[1]);
  });

  it('un id desconocido devuelve undefined', () => {
    expect(guiaPorId([guia()], 'no-existe')).toBeUndefined();
  });
});
