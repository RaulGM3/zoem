import { describe, it, expect } from 'vitest';
import type { Guia, TareaGuia } from './guia';
import { buscarGuias } from './buscar-guias';

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

const CASOS = guia({
  id: 'casos',
  titulo: 'Casos',
  resumen: 'Expedientes del despacho.',
  tareas: [
    tarea({ id: 'crear-caso', titulo: 'Crear un caso nuevo', claves: ['alta', 'expediente'], pasos: ['Pulsa "Nuevo caso".'] }),
    tarea({ id: 'cerrar-caso', titulo: 'Cerrar un caso', pasos: ['Abre el caso.', 'Cambia el estado.'] }),
    tarea({ id: 'usar-plantilla', titulo: 'Usar una plantilla', pasos: ['Pulsa "Plantillas".'] }),
  ],
});

const CONTACTOS = guia({
  id: 'contactos',
  titulo: 'Contactos',
  modulo: 'Contactos',
  ruta: '/contactos',
  resumen: 'Clientes y personas relacionadas.',
  tareas: [
    tarea({ id: 'crear-contacto', titulo: 'Crear un contacto', claves: ['cliente'], pasos: ['Pulsa "Nuevo contacto".'] }),
    tarea({ id: 'cambiar-estado', titulo: 'Cambiar el estado', pasos: ['Pulsa el chip de estado del contacto.'] }),
  ],
});

const TESORERIA = guia({
  id: 'tesoreria',
  titulo: 'Tesorería',
  modulo: 'Tesorería',
  ruta: '/tesoreria',
  resumen: 'Cuentas y movimientos de dinero.',
  claves: ['bancos', 'caja'],
  tareas: [tarea({ id: 'registrar-movimiento', titulo: 'Registrar un movimiento', pasos: ['Pulsa "Nuevo movimiento".'] })],
});

const TODAS = [CASOS, CONTACTOS, TESORERIA];

const ids = (consulta: string, guias: readonly Guia[] = TODAS) =>
  buscarGuias(guias, consulta).map(r => r.guia.id);

const tareasDe = (consulta: string, guias: readonly Guia[] = TODAS) =>
  buscarGuias(guias, consulta).flatMap(r => r.tareas.map(t => t.id));

describe('buscarGuias — sin consulta', () => {
  it('la consulta vacía devuelve todas las guías, con todas sus tareas, en el orden original', () => {
    const out = buscarGuias(TODAS, '');
    expect(out.map(r => r.guia)).toEqual(TODAS);
    expect(out.map(r => r.tareas.length)).toEqual([3, 2, 1]);
  });

  it('la consulta en blanco no filtra nada', () => {
    expect(ids('   ')).toEqual(['casos', 'contactos', 'tesoreria']);
  });

  it('una consulta hecha solo de palabras vacías tampoco filtra', () => {
    expect(ids('¿Cómo puedo hacer?')).toEqual(['casos', 'contactos', 'tesoreria']);
  });
});

describe('buscarGuias — coincidencias', () => {
  it('devuelve solo las tareas que coinciden dentro de cada guía', () => {
    expect(tareasDe('cerrar')).toEqual(['cerrar-caso']);
  });

  it('ignora acentos y mayúsculas en ambos sentidos', () => {
    expect(ids('tesoreria')).toEqual(['tesoreria']);
    expect(ids('TESORERÍA')).toEqual(['tesoreria']);
    const sinAcento = guia({ id: 'tesoreria', titulo: 'Tesoreria', tareas: [tarea()] });
    expect(ids('tesorería', [sinAcento])).toEqual(['tesoreria']);
  });

  it('busca en las claves de la tarea', () => {
    expect(tareasDe('expediente')).toEqual(['crear-caso']);
  });

  it('busca en los pasos de la tarea', () => {
    expect(tareasDe('chip')).toEqual(['cambiar-estado']);
  });

  it('varias palabras funcionan como AND dentro de la misma tarea', () => {
    expect(tareasDe('crear contacto')).toEqual(['crear-contacto']);
    expect(tareasDe('crear movimiento')).toEqual([]);
  });

  it('una palabra puede venir del título de la guía y otra de la tarea', () => {
    expect(tareasDe('tesorería registrar')).toEqual(['registrar-movimiento']);
  });

  it('si coincide la guía pero ninguna tarea, devuelve la guía con todas sus tareas', () => {
    const out = buscarGuias(TODAS, 'bancos');
    expect(out.map(r => r.guia.id)).toEqual(['tesoreria']);
    expect(out[0].tareas).toEqual(TESORERIA.tareas);
  });

  it('busca también en el resumen de la guía', () => {
    expect(ids('dinero')).toEqual(['tesoreria']);
  });

  it('tolera el plural de la consulta', () => {
    expect(tareasDe('plantillas')).toEqual(['usar-plantilla']);
    expect(tareasDe('movimientos')).toEqual(['registrar-movimiento']);
  });

  it('descarta signos y palabras vacías de una pregunta natural', () => {
    expect(tareasDe('¿Cómo puedo crear un contacto?')).toEqual(['crear-contacto']);
    expect(ids('¿Para qué sirve Tesorería?')).toEqual(['tesoreria']);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(buscarGuias(TODAS, 'nóminas')).toEqual([]);
  });
});

describe('buscarGuias — orden', () => {
  const enTitulo = guia({ id: 'casos', titulo: 'Uno', tareas: [tarea({ titulo: 'Exportar datos' })] });
  const enClaves = guia({ id: 'contactos', titulo: 'Dos', tareas: [tarea({ claves: ['exportar'] })] });
  const enPasos = guia({ id: 'documentos', titulo: 'Tres', tareas: [tarea({ pasos: ['Pulsa Exportar.'] })] });
  const enResumen = guia({ id: 'tesoreria', titulo: 'Cuatro', resumen: 'Permite exportar.', tareas: [tarea()] });

  it('pesa título de tarea > claves > pasos > resumen de la guía', () => {
    expect(ids('exportar', [enResumen, enPasos, enClaves, enTitulo])).toEqual([
      'casos',
      'contactos',
      'documentos',
      'tesoreria',
    ]);
  });

  it('en caso de empate conserva el orden de entrada', () => {
    const a = guia({ id: 'casos', titulo: 'A', tareas: [tarea({ titulo: 'Exportar' })] });
    const b = guia({ id: 'contactos', titulo: 'B', tareas: [tarea({ titulo: 'Exportar' })] });
    expect(ids('exportar', [a, b])).toEqual(['casos', 'contactos']);
    expect(ids('exportar', [b, a])).toEqual(['contactos', 'casos']);
  });

  it('los puntos son 0 sin consulta y positivos cuando hay coincidencia', () => {
    expect(buscarGuias([enTitulo], '')[0].puntos).toBe(0);
    expect(buscarGuias([enTitulo], 'exportar')[0].puntos).toBeGreaterThan(0);
  });
});
