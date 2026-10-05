import { Timestamp } from '@angular/fire/firestore';

export type Canal = 'gmail' | 'outlook' | 'mail' | 'whatsapp';
export type AmbitoAccion = 'contacto' | 'caso';

export const CANALES: readonly Canal[] = ['gmail', 'outlook', 'mail', 'whatsapp'];
export const AMBITOS_ACCION: readonly AmbitoAccion[] = ['contacto', 'caso'];

export const CANAL_LABELS: Record<Canal, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  mail: 'Correo (app por defecto)',
  whatsapp: 'WhatsApp',
};

/**
 * Plantilla de mensaje a nivel de empresa (`companies/{cid}/acciones`).
 * `asunto` y `cuerpo` son texto plano con `{{variables}}`. Si `docTemplateId`
 * está presente, al ejecutarla se genera un .docx a partir de esa plantilla de
 * Documentos y se adjunta como enlace firmado al cuerpo.
 *
 * Si lleva `plantillaId` + `hitoPlantillaId`, se sugiere al completar ese hito
 * en un caso creado desde esa plantilla; sin ellos es una acción de catálogo.
 */
export interface Accion {
  id: string;
  companyId: string;
  nombre: string;
  ambito: AmbitoAccion;
  asunto: string;
  cuerpo: string;
  docTemplateId?: string;
  canales: Canal[];
  activa: boolean;
  plantillaId?: string;
  hitoPlantillaId?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AccionInput = Omit<Accion, 'id' | 'companyId' | 'createdBy' | 'createdAt' | 'updatedAt'>;

/** Traza de una ejecución (`companies/{cid}/accion_registros`). Append-only. */
export interface AccionRegistro {
  id: string;
  companyId: string;
  accionId: string;
  /** Snapshot del nombre: el registro sigue siendo legible si la acción se borra. */
  accionNombre: string;
  contactoIds: string[];
  casoId?: string;
  hitoId?: string;
  canal: Canal;
  /** Ruta en Storage del .docx generado, si la acción tenía documento. */
  docPath?: string;
  createdBy: string;
  createdAt: Timestamp;
}
