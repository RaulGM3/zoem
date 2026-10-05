import type { Accion } from '../../interfaces/accion.interface';
import type { Hito, HitoEstado } from '../../interfaces/caso.interface';

/**
 * Acciones a sugerir cuando un hito pasa a `completado`: las ligadas a su hito
 * de plantilla de origen. Es una ayuda: cualquier fallo devuelve [] para no
 * estropear el cambio de estado que acaba de hacerse.
 */
export async function accionesSugeridasAlCompletar(
  hito: Pick<Hito, 'plantillaId' | 'hitoPlantillaId'>,
  nuevoEstado: HitoEstado,
  listar: (plantillaId: string, hitoPlantillaId: string) => Promise<Accion[]>,
): Promise<Accion[]> {
  if (nuevoEstado !== 'completado' || !hito.plantillaId || !hito.hitoPlantillaId) return [];
  try {
    return await listar(hito.plantillaId, hito.hitoPlantillaId);
  } catch {
    return [];
  }
}
