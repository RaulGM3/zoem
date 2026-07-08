import type { FirmRole } from '../../interfaces/member';
import type { PlantillaVisibility } from '../../interfaces/plantilla-file.interface';

/**
 * Lógica PURA de acceso a nivel de documento — espejo EXACTO de las
 * condiciones de firestore.rules para clasificados y visibilidad de
 * plantillas. Servicios y UI consumen SOLO estas funciones para que el
 * cliente y las rules nunca diverjan (mismo principio que `can()`).
 */

export interface ClassifiedDoc {
  clasificado?: boolean;
  allowedUserIds?: string[];
}

export interface VisibilityScoped {
  visibleTo?: PlantillaVisibility;
  visibleRoles?: FirmRole[];
  visibleUserIds?: string[];
}

/** ¿Puede este miembro ver el documento? (rules: `allow get` de doc_files). */
export function canReadDoc(
  doc: ClassifiedDoc,
  uid: string,
  role: FirmRole | null,
  isSuperUser: boolean,
): boolean {
  if (isSuperUser || role === 'Admin') return true;
  if (doc.clasificado !== true) return true; // ausente (legacy) == no clasificado
  return (doc.allowedUserIds ?? []).includes(uid);
}

/** ¿Puede este miembro ver la plantilla? (rules: `allow get` de plantillas). */
export function canSeePlantilla(
  plantilla: VisibilityScoped,
  uid: string,
  role: FirmRole | null,
  isSuperUser: boolean,
): boolean {
  if (isSuperUser || role === 'Admin') return true;
  if (plantilla.visibleTo !== 'restricted') return true; // ausente == 'all'
  if ((plantilla.visibleUserIds ?? []).includes(uid)) return true;
  return role !== null && (plantilla.visibleRoles ?? []).includes(role);
}
