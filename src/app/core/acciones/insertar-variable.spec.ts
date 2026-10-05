import { describe, it, expect } from 'vitest';
import { insertarVariable, VARIABLES_ACCION } from './insertar-variable';

describe('insertarVariable', () => {
  it('inserta {{clave}} en la posición del cursor y devuelve el cursor tras la variable', () => {
    expect(insertarVariable('Hola , gracias', 'cliente', 5, 5)).toEqual({
      texto: 'Hola {{cliente}}, gracias',
      cursor: 16,
    });
  });

  it('reemplaza la selección', () => {
    expect(insertarVariable('Hola XXX', 'hito', 5, 8)).toEqual({ texto: 'Hola {{hito}}', cursor: 13 });
  });

  it('sin posición (null) añade al final', () => {
    expect(insertarVariable('Hola ', 'caso', null, null)).toEqual({ texto: 'Hola {{caso}}', cursor: 13 });
  });

  it('expone las claves del contexto de acción', () => {
    const claves = VARIABLES_ACCION.map((v) => v.key);
    expect(claves).toEqual(expect.arrayContaining(['cliente', 'caso', 'hito', 'empresa', 'fecha', 'email']));
    expect(new Set(claves).size).toBe(claves.length);
  });
});
