import { describe, it, expect, vi } from 'vitest';
import { accionesSugeridasAlCompletar } from './sugerencia-hito';
import type { Accion } from '../../interfaces/accion.interface';

const acc = { id: 'a1' } as Accion;

describe('accionesSugeridasAlCompletar', () => {
  const listar = vi.fn();

  it('devuelve las acciones del hito de plantilla cuando pasa a completado', async () => {
    listar.mockResolvedValue([acc]);
    const r = await accionesSugeridasAlCompletar(
      { plantillaId: 'p1', hitoPlantillaId: 'h1' }, 'completado', listar,
    );
    expect(listar).toHaveBeenCalledWith('p1', 'h1');
    expect(r).toEqual([acc]);
  });

  it.each(['pendiente', 'en_progreso', 'cancelado'] as const)('no sugiere si el nuevo estado es %s', async (estado) => {
    listar.mockClear();
    expect(await accionesSugeridasAlCompletar({ plantillaId: 'p1', hitoPlantillaId: 'h1' }, estado, listar)).toEqual([]);
    expect(listar).not.toHaveBeenCalled();
  });

  it('no sugiere si el hito no viene de una plantilla', async () => {
    listar.mockClear();
    expect(await accionesSugeridasAlCompletar({}, 'completado', listar)).toEqual([]);
    expect(await accionesSugeridasAlCompletar({ plantillaId: 'p1' }, 'completado', listar)).toEqual([]);
    expect(listar).not.toHaveBeenCalled();
  });

  it('un fallo al consultar nunca bloquea: devuelve []', async () => {
    listar.mockRejectedValue(new Error('x'));
    expect(await accionesSugeridasAlCompletar({ plantillaId: 'p1', hitoPlantillaId: 'h1' }, 'completado', listar)).toEqual([]);
  });
});
