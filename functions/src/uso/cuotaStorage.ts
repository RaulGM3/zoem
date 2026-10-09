import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import * as logger from 'firebase-functions/logger';
import { vigentesEn, type DerechosDoc } from '../planes/derechosDoc';
import { decidirCuotaArchivo, parseRutaArchivo, type RutaArchivo } from './cuotaArchivos';

const REINTENTOS_MARCADO = 3;
const ESPERA_MARCADO_MS = 2000;

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Docs de metadatos (doc_files / contact_files) que apuntan a este objeto: SON los que suma el contador. */
function consultaMetadatos(ruta: RutaArchivo, nombre: string) {
  const db = admin.firestore();
  return ruta.tipo === 'caso'
    ? db.collection(`companies/${ruta.cid}/casos/${ruta.casoId}/doc_files`).where('storagePath', '==', nombre)
    : db.collection('contact_files').where('companyId', '==', ruta.cid).where('storagePath', '==', nombre);
}

/** Slots del checklist de un caso (doc_slots) que apuntan al objeto: ocupan espacio pero NO están en el contador. */
function consultaSlots(ruta: RutaArchivo, nombre: string) {
  return ruta.tipo === 'caso'
    ? admin.firestore().collection(`companies/${ruta.cid}/casos/${ruta.casoId}/doc_slots`).where('storagePath', '==', nombre)
    : null;
}

/**
 * RED DE SEGURIDAD de la cuota de almacenamiento. Las Storage rules ya rechazan antes de subir lo que no
 * cabe; este trigger elimina lo que aun así se cuela (carreras entre subidas simultáneas, que el contador
 * es eventualmente consistente) para no dejar blobs huérfanos que gasten espacio sin doc que los muestre.
 *
 * Coherencia con onArchivoCasoUso / onArchivoContactoUso: el contador suma `sizeBytes` del doc de
 * metadatos, que se crea DESPUÉS de subir. Por eso: si ya hay doc que referencia el objeto se considera
 * contado; si no, se suma su tamaño al uso. Orden de lectura: PRIMERO el contador y DESPUÉS el doc; así el
 * único fallo posible es no sumar de más (conservar), nunca contar dos veces y borrar un archivo legítimo.
 *
 * Si borra el objeto y existe (o aparece en unos segundos) un doc de metadatos, lo marca como eliminado
 * (soft delete, igual que la app) con `eliminadoPorCuota: true`, para que no quede un enlace roto.
 * Limitación: aplica también a uploads de superusuario (las rules les dejan pasar, el trigger no sabe quién subió).
 */
export const limitarCuotaArchivos = onObjectFinalized({ memory: '256MiB' }, async (event) => {
  const nombre = event.data.name;
  const ruta = parseRutaArchivo(nombre);
  if (!ruta) return;
  const tamano = Number(event.data.size);
  if (!Number.isFinite(tamano)) return;

  const db = admin.firestore();
  const empresa = await db.doc(`companies/${ruta.cid}`).get();
  if (!empresa.exists) return;
  const derechos = vigentesEn(empresa.get('derechos') as DerechosDoc | undefined, new Date());
  if (!derechos) return; // empresa legada: sin límites
  const limiteMB = derechos.limites.documentosMB;

  const uso = await db.doc(`companies/${ruta.cid}/uso/total`).get(); // contador ANTES que el doc
  const metadatos = await consultaMetadatos(ruta, nombre).limit(1).get();

  const decision = decidirCuotaArchivo({
    usadoBytes: Number(uso.get('documentosBytes') ?? 0),
    tamano,
    contado: !metadatos.empty,
    limiteMB,
  });
  if (decision.accion === 'conservar') return;

  logger.warn('Archivo eliminado por superar la cuota de almacenamiento', { nombre, cid: ruta.cid, tamano, ...decision });
  await admin.storage().bucket(event.data.bucket).file(nombre).delete({ ignoreNotFound: true });

  // El doc de metadatos suele crearse justo después de subir: se reintenta unos segundos.
  for (let i = 0; i < REINTENTOS_MARCADO; i++) {
    const [archivos, slots] = await Promise.all([consultaMetadatos(ruta, nombre).get(), consultaSlots(ruta, nombre)?.get()]);
    if (!archivos.empty || (slots && !slots.empty)) {
      await Promise.all([
        ...archivos.docs.map((d) => d.ref.update({
          deleted: true,
          deletedAt: FieldValue.serverTimestamp(),
          deletedBy: 'sistema',
          deletedByNombre: 'Sistema (cuota de almacenamiento)',
          eliminadoPorCuota: true,
        })),
        // El slot vuelve a "pendiente" (como al retirar un archivo) para que se pueda volver a subir.
        ...(slots?.docs ?? []).map((d) => d.ref.update({
          status: 'pendiente', storagePath: null, downloadUrl: null, eliminadoPorCuota: true, updatedAt: FieldValue.serverTimestamp(),
        })),
      ]);
      logger.info('Docs de metadatos marcados por cuota', { nombre, archivos: archivos.size, slots: slots?.size ?? 0 });
      return;
    }
    if (i < REINTENTOS_MARCADO - 1) await esperar(ESPERA_MARCADO_MS);
  }
});
