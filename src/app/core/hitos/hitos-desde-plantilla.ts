import type { Hito } from '../../interfaces/caso.interface';
import type { CasoPlantilla } from '../../interfaces/plantilla.interface';

export type HitoNuevo = Omit<Hito, 'id' | 'casoId' | 'casoTitulo'>;

/**
 * Hitos de un caso nuevo a partir de su plantilla. Cada hito guarda su origen
 * (`plantillaId` + `hitoPlantillaId`) para poder sugerir las acciones ligadas
 * a ese hito de plantilla cuando se complete.
 */
export function hitosDesdePlantilla(
  plantilla: Pick<CasoPlantilla, 'id' | 'hitos'>,
  inicio: Date,
): HitoNuevo[] {
  return plantilla.hitos.map((h) => {
    const fecha = new Date(inicio);
    fecha.setDate(fecha.getDate() + h.diasDesdeInicio);
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return {
      titulo: h.titulo,
      ...(h.descripcion ? { descripcion: h.descripcion } : {}),
      fechaEstimada: `${y}-${m}-${d}`,
      ...(h.asignadoA ? { asignadoA: h.asignadoA } : {}),
      estado: 'pendiente' as const,
      orden: h.orden,
      plantillaId: plantilla.id,
      hitoPlantillaId: h.id,
    };
  });
}
