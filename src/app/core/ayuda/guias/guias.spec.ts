import { describe, it, expect } from 'vitest';
import { RUTAS_POR_MODULO } from '../../agent/tools/navegacion.tools';
import { MODULOS } from '../../permissions/permissions';
import { cargarGuias } from '../cargar-guias';
import { GUIA_IDS } from '../guia';
import { GUIAS, SIN_GUIA } from './index';

/**
 * Red de seguridad del CONTENIDO: estas pruebas no comprueban lógica, sino que
 * nadie añada un módulo o una guía a medias sin enterarse.
 */
describe('GUIAS — cobertura', () => {
  it('todo módulo tiene guía, salvo los declarados en SIN_GUIA', () => {
    const conGuia = new Set(GUIAS.map(g => g.modulo));
    const huerfanos = MODULOS.filter(m => !conGuia.has(m) && !SIN_GUIA.includes(m));
    expect(huerfanos).toEqual([]);
  });

  it('SIN_GUIA no lista módulos que ya tienen guía', () => {
    const conGuia = new Set(GUIAS.map(g => g.modulo));
    expect(SIN_GUIA.filter(m => conGuia.has(m))).toEqual([]);
  });

  it('los ids son únicos', () => {
    const ids = GUIAS.map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo id del catálogo GUIA_IDS tiene su guía escrita', () => {
    const escritas = new Set<string>(GUIAS.map(g => g.id));
    expect(GUIA_IDS.filter(id => !escritas.has(id))).toEqual([]);
  });

  it('la ruta de una guía de módulo es la misma a la que navega el agente', () => {
    for (const g of GUIAS) {
      if (g.modulo) expect(g.ruta, g.id).toBe(RUTAS_POR_MODULO[g.modulo]);
    }
  });
});

describe('GUIAS — forma del contenido', () => {
  it('toda guía tiene resumen, para qué y al menos una tarea', () => {
    for (const g of GUIAS) {
      expect(g.resumen.trim(), g.id).not.toBe('');
      expect(g.paraQue.trim(), g.id).not.toBe('');
      expect(g.tareas.length, g.id).toBeGreaterThan(0);
    }
  });

  it('toda tarea tiene título y al menos un paso con texto', () => {
    for (const g of GUIAS) {
      for (const t of g.tareas) {
        expect(t.titulo.trim(), `${g.id}/${t.id}`).not.toBe('');
        expect(t.pasos.length, `${g.id}/${t.id}`).toBeGreaterThan(0);
        expect(t.pasos.every(p => p.trim() !== ''), `${g.id}/${t.id}`).toBe(true);
      }
    }
  });

  it('los ids de tarea son únicos dentro de su guía', () => {
    for (const g of GUIAS) {
      const ids = g.tareas.map(t => t.id);
      expect(new Set(ids).size, g.id).toBe(ids.length);
    }
  });

  it('el producto se llama Vertey en todo el contenido', () => {
    expect(JSON.stringify(GUIAS)).not.toMatch(/zoem/i);
  });
});

describe('cargarGuias', () => {
  it('resuelve con el catálogo completo', async () => {
    expect(await cargarGuias()).toBe(GUIAS);
  });
});
