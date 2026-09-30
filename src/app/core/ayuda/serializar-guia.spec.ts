import { describe, it, expect } from 'vitest';
import type { Guia, TareaGuia } from './guia';
import { AVISO_MAS_TAREAS, serializarGuia } from './serializar-guia';

function tarea(p: Partial<TareaGuia> = {}): TareaGuia {
  return { id: 'tarea', titulo: 'Tarea', pasos: ['Paso'], claves: [], ...p };
}

function guia(p: Partial<Guia> = {}): Guia {
  return {
    id: 'casos',
    titulo: 'Casos',
    modulo: 'Casos',
    ruta: '/casos',
    resumen: 'Expedientes del despacho.',
    paraQue: 'Seguir cada asunto de principio a fin.',
    tareas: [
      tarea({
        id: 'crear',
        titulo: 'Crear un caso nuevo',
        pasos: ['Pulsa "Nuevo caso".', 'Elige el cliente.', 'Pulsa "Guardar".'],
        claves: ['expediente-clave-oculta'],
        nota: 'El cliente debe existir antes.',
      }),
      tarea({ id: 'cerrar', titulo: 'Cerrar un caso', pasos: ['Abre el caso.'] }),
    ],
    claves: ['guia-clave-oculta'],
    ...p,
  };
}

describe('serializarGuia', () => {
  it('encabeza con el título, la ruta, el resumen y el para qué', () => {
    const texto = serializarGuia(guia());
    expect(texto).toContain('Guía: Casos (pantalla: /casos)');
    expect(texto).toContain('Expedientes del despacho.');
    expect(texto).toContain('Seguir cada asunto de principio a fin.');
  });

  it('numera los pasos de cada tarea en orden', () => {
    const texto = serializarGuia(guia());
    expect(texto).toContain('Tarea: Crear un caso nuevo\n1. Pulsa "Nuevo caso".\n2. Elige el cliente.\n3. Pulsa "Guardar".');
    expect(texto).toContain('Tarea: Cerrar un caso\n1. Abre el caso.');
  });

  it('incluye la nota de la tarea', () => {
    expect(serializarGuia(guia())).toContain('Nota: El cliente debe existir antes.');
  });

  it('no incluye las claves de búsqueda: son ruido para el modelo', () => {
    const texto = serializarGuia(guia());
    expect(texto).not.toContain('clave-oculta');
  });

  it('serializa solo las tareas que se le pasan', () => {
    const g = guia();
    const texto = serializarGuia(g, [g.tareas[1]]);
    expect(texto).toContain('Cerrar un caso');
    expect(texto).not.toContain('Crear un caso nuevo');
  });

  it('sin tareas deja solo el encabezado', () => {
    const texto = serializarGuia(guia(), []);
    expect(texto).toContain('Guía: Casos');
    expect(texto).not.toContain('Tarea:');
  });

  it('respeta el tope de caracteres sin cortar una tarea a la mitad', () => {
    const muchas = Array.from({ length: 40 }, (_, i) =>
      tarea({ id: `t${i}`, titulo: `Tarea número ${i}`, pasos: ['Primer paso de la tarea.', 'Segundo paso de la tarea.'] }),
    );
    const texto = serializarGuia(guia({ tareas: muchas }), muchas, 600);

    expect(texto.length).toBeLessThanOrEqual(600);
    expect(texto.endsWith(AVISO_MAS_TAREAS)).toBe(true);
    expect(texto).toContain('Tarea número 0');
    expect(texto).not.toContain('Tarea número 39');
    // Toda tarea que aparece lo hace entera: título y sus dos pasos.
    const titulos = texto.match(/Tarea: /g)?.length ?? 0;
    const segundos = texto.match(/2\. Segundo paso/g)?.length ?? 0;
    expect(segundos).toBe(titulos);
  });

  it('si todo cabe no añade el aviso de que hay más', () => {
    expect(serializarGuia(guia())).not.toContain(AVISO_MAS_TAREAS);
  });
});
