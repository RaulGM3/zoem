import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { contarUso } from './aplicar';

const DB = '(default)';

type Datos = Record<string, unknown> | undefined;

// Casos y contactos se cuentan DENTRO de los triggers existentes (notificaciones/triggers.ts) para no
// duplicar disparadores sobre la misma ruta; el resto vive aquí.

export const onPlantillaUso = onDocumentWritten(
  { document: 'companies/{cid}/casoPlantillas/{id}', database: DB },
  async (event) => {
    await contarUso('plantilla', event.params['cid'], event.params['id'], event.data?.before?.data() as Datos, event.data?.after?.data() as Datos);
  },
);

export const onMiembroUso = onDocumentWritten(
  { document: 'companies/{cid}/members/{uid}', database: DB },
  async (event) => {
    await contarUso('miembro', event.params['cid'], event.params['uid'], event.data?.before?.data() as Datos, event.data?.after?.data() as Datos);
  },
);

export const onArchivoCasoUso = onDocumentWritten(
  { document: 'companies/{cid}/casos/{casoId}/doc_files/{fileId}', database: DB },
  async (event) => {
    await contarUso('archivo', event.params['cid'], event.params['fileId'], event.data?.before?.data() as Datos, event.data?.after?.data() as Datos);
  },
);

/** Archivos de contacto: colección raíz con `companyId` en el doc. */
export const onArchivoContactoUso = onDocumentWritten(
  { document: 'contact_files/{fileId}', database: DB },
  async (event) => {
    const antes = event.data?.before?.data() as Datos;
    const despues = event.data?.after?.data() as Datos;
    const cid = (despues?.['companyId'] ?? antes?.['companyId']) as string | undefined;
    if (!cid) return;
    await contarUso('archivo', cid, event.params['fileId'], antes, despues);
  },
);

/** Cada ejecución de una acción cuenta en el mes en que se registra. */
export const onAccionRegistroUso = onDocumentCreated(
  { document: 'companies/{cid}/accion_registros/{id}', database: DB },
  async (event) => {
    await contarUso('accion', event.params['cid'], event.params['id'], undefined, event.data?.data() as Datos, new Date(event.time));
  },
);

/** Slots del checklist (doc_slots): sus subidas ocupan Storage igual que doc_files. */
export const onSlotCasoUso = onDocumentWritten(
  { document: 'companies/{cid}/casos/{casoId}/doc_slots/{slotId}', database: DB },
  async (event) => {
    await contarUso('archivo', event.params['cid'], event.params['slotId'], event.data?.before?.data() as Datos, event.data?.after?.data() as Datos);
  },
);

/** Adjuntos de facturas recibidas (`adjunto.size`). */
export const onFacturaRecibidaUso = onDocumentWritten(
  { document: 'companies/{cid}/facturas_recibidas/{facturaId}', database: DB },
  async (event) => {
    await contarUso('factura', event.params['cid'], event.params['facturaId'], event.data?.before?.data() as Datos, event.data?.after?.data() as Datos);
  },
);

/** Archivo fuente (.pdf/.docx) de las plantillas de documento (`sourceSizeBytes`). */
export const onDocTemplateUso = onDocumentWritten(
  { document: 'companies/{cid}/docTemplates/{templateId}', database: DB },
  async (event) => {
    await contarUso('docTemplate', event.params['cid'], event.params['templateId'], event.data?.before?.data() as Datos, event.data?.after?.data() as Datos);
  },
);
