import { describe, it, expect } from 'vitest';
import { hitosDesdePlantilla } from './hitos-desde-plantilla';

describe('hitosDesdePlantilla', () => {
  const plantilla = {
    id: 'p1',
    hitos: [
      { id: 'hp1', titulo: 'Demanda', descripcion: 'Presentar', diasDesdeInicio: 0, orden: 1, asignadoA: 'u1' },
      { id: 'hp2', titulo: 'Vista', diasDesdeInicio: 10, orden: 2 },
    ],
  };
  const inicio = new Date(2026, 9, 5);

  it('conserva el origen: plantillaId y hitoPlantillaId', () => {
    const [a, b] = hitosDesdePlantilla(plantilla, inicio);
    expect(a.plantillaId).toBe('p1');
    expect(a.hitoPlantillaId).toBe('hp1');
    expect(b.hitoPlantillaId).toBe('hp2');
  });

  it('copia datos, estado pendiente y fecha estimada', () => {
    const [a, b] = hitosDesdePlantilla(plantilla, inicio);
    expect(a).toMatchObject({ titulo: 'Demanda', descripcion: 'Presentar', asignadoA: 'u1', estado: 'pendiente', orden: 1 });
    expect(b.fechaEstimada).toBe('2026-10-15');
    expect('descripcion' in b).toBe(false);
    expect('asignadoA' in b).toBe(false);
  });

  it('no muta la fecha de inicio', () => {
    hitosDesdePlantilla(plantilla, inicio);
    expect(inicio.getDate()).toBe(5);
  });
});
