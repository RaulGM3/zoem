import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
  writeBatch,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { ActividadService } from './actividad.service';
import { PermissionService } from './permission.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { Contact, getContactDisplayName } from '../../interfaces';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);
  private readonly actividad = inject(ActividadService);
  private readonly permissionService = inject(PermissionService);

  readonly contacts = signal<Contact[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private contactsCollection(companyId: string) {
    return collection(this.firestore, 'companies', companyId, 'contactos');
  }

  private contactDoc(companyId: string, id: string) {
    return doc(this.firestore, 'companies', companyId, 'contactos', id);
  }

  async loadContacts(): Promise<void> {
    this.isLoading.set(true);
    try {
      const companyId = this.companyId;
      const snapshot = await getDocs(this.contactsCollection(companyId));
      this.contacts.set(
        snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Contact)
          .filter((c) => c.deleted !== true)
      );
    } finally {
      // El error se propaga al llamador para que lo muestre vía ToastService.
      // (Antes se tragaba en silencio y la lista quedaba vacía sin avisar.)
      this.isLoading.set(false);
    }
  }

  async getContact(id: string): Promise<Contact | null> {
    const snapshot = await getDoc(this.contactDoc(this.companyId, id));
    if (!snapshot.exists()) return null;
    const contact = { id: snapshot.id, ...snapshot.data() } as Contact;
    return contact.deleted === true ? null : contact;
  }

  async createContact(
    data: Omit<Contact, 'id' | 'companyId' | 'updatedAt'>
  ): Promise<void> {
    const payload = data as Record<string, unknown>;
    const providedCreatedAt = payload['createdAt'] as Timestamp | undefined;
    const createdAt = providedCreatedAt ?? Timestamp.now();
    const ref = await addDoc(this.contactsCollection(this.companyId), stripUndefinedDeep({
      ...payload,
      companyId: this.companyId,
      createdAt: providedCreatedAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    // Actualización incremental del signal local: evita releer TODA la
    // colección (loadContacts) tras cada escritura — crítico para la
    // importación masiva (importar-contactos.ts), que crea N contactos en
    // un loop y antes disparaba O(N × total_contacts) lecturas.
    const newContact = {
      ...payload,
      id: ref.id,
      companyId: this.companyId,
      createdAt,
      updatedAt: createdAt,
    } as Contact;
    this.contacts.update((list) => [...list, newContact]);
    // El log de actividad es best-effort: la escritura principal YA tuvo
    // éxito y el signal local ya está parcheado, así que un fallo aquí no
    // debe surgir como error al usuario (antes rompía con un toast de error
    // pese a que el contacto SÍ se creó, e invitaba a "reintentar" y crear
    // un duplicado).
    try {
      await this.actividad.log('Contactos', `Creó el contacto ${getContactDisplayName(data as Contact)}`, ref.id);
    } catch (err) {
      console.error('[ContactService] Error al registrar actividad de creación', err);
    }
  }

  async updateContact(id: string, data: Record<string, unknown>): Promise<void> {
    const payload = stripUndefinedDeep({
      ...data,
      updatedAt: serverTimestamp(),
    });
    console.log('[Firebase][updateContact] → updateDoc companies/%s/contactos/%s', this.companyId, id, payload);
    try {
      await updateDoc(this.contactDoc(this.companyId, id), payload);
      console.log('[Firebase][updateContact] ✓ updateDoc OK');
    } catch (err) {
      console.error('[Firebase][updateContact] ✗ updateDoc FAIL', err);
      throw err;
    }
    const found = this.contacts().find(c => c.id === id);
    const nombre = found ? getContactDisplayName(found) : 'un contacto';
    // Parcheo incremental en lugar de recargar toda la colección (ver nota
    // en createContact).
    const now = Timestamp.now();
    this.contacts.update((list) =>
      list.map((c) => (c.id === id ? ({ ...c, ...data, updatedAt: now } as Contact) : c))
    );
    // Ver nota en createContact: el log de actividad no debe surgir como
    // error de la operación principal si esta ya tuvo éxito.
    try {
      console.log('[Firebase][updateContact] → actividad.log (addDoc companies/%s/actividad)', this.companyId);
      await this.actividad.log('Contactos', `Editó el contacto ${nombre}`, id);
      console.log('[Firebase][updateContact] ✓ actividad.log OK');
    } catch (err) {
      console.error('[Firebase][updateContact] ✗ actividad.log FAIL', err);
    }
  }

  async deleteContact(id: string): Promise<void> {
    const found = this.contacts().find(c => c.id === id);
    const nombre = found ? getContactDisplayName(found) : 'un contacto';
    const uid = this.auth.currentUser?.uid ?? '';
    const softDeletePayload = stripUndefinedDeep({
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: uid,
      deletedByNombre: this.permissionService.currentMember()?.nombre ?? '',
    });
    // Cascade ANTES que el contacto: cascadeSoftDeleteRelated puede rechazar
    // el borrado (documento clasificado sin permisos de admin) y si el
    // contacto ya estuviera soft-deleted quedaría en un estado inconsistente
    // — soft-deleted pero con carpetas/archivos huérfanos sin marcar.
    await this.cascadeSoftDeleteRelated(id);
    // Soft delete auditable: el contacto queda en Firestore con su rastro de
    // quién/cuándo lo eliminó (igual que contact_folders/contact_files) en
    // vez de borrarse físicamente y perder esa trazabilidad.
    await updateDoc(this.contactDoc(this.companyId, id), softDeletePayload);
    this.contacts.update((list) => list.filter((c) => c.id !== id));
    // Ver nota en createContact: el log de actividad no debe surgir como
    // error de la operación principal si esta ya tuvo éxito.
    try {
      await this.actividad.log('Contactos', `Eliminó el contacto ${nombre}`, id);
    } catch (err) {
      console.error('[ContactService] Error al registrar actividad de eliminación', err);
    }
  }

  /**
   * Al eliminar un contacto, sus carpetas/archivos (`contact_folders` /
   * `contact_files`) quedarían huérfanos referenciando un `contactId` muerto
   * — igual que los blobs en Storage. Como esos módulos ya usan soft delete
   * (ver `SoftDeletable` en doc-lifecycle.interface.ts), aquí hacemos
   * cascade soft-delete para mantener la misma trazabilidad en vez de dejar
   * basura sin limpiar. El propio contacto se soft-elimina después de esta
   * cascada (ver deleteContact).
   */
  private async cascadeSoftDeleteRelated(contactId: string): Promise<void> {
    const uid = this.auth.currentUser?.uid ?? '';
    // Las rules de contact_folders/contact_files exigen `isMember(resource.data.companyId)`.
    // Un `list()` filtrado SOLO por `contactId` no le prueba a Firestore que
    // todo resultado cumple `companyId == this.companyId` (la query no
    // menciona ese campo) y Firestore rechaza la query entera con
    // permission-denied, sin evaluar rol/estado del usuario. Filtrar también
    // por companyId (igual que ContactFileService.loadFiles) es lo que hace
    // la query demostrable.
    const companyId = this.companyId;
    const [folderSnap, fileSnap] = await Promise.all([
      getDocs(query(
        collection(this.firestore, 'contact_folders'),
        where('companyId', '==', companyId),
        where('contactId', '==', contactId),
      )),
      getDocs(query(
        collection(this.firestore, 'contact_files'),
        where('companyId', '==', companyId),
        where('contactId', '==', contactId),
      )),
    ]);

    // Las reglas de Firestore solo permiten actualizar un `contact_files` con
    // `clasificado === true` a un company-admin. Si un usuario sin ese rol
    // intenta borrar el contacto, ese `updateDoc` sería rechazado — y si lo
    // hiciéramos con `Promise.all` de escrituras independientes, el resto de
    // carpetas/archivos ya podría haberse marcado como eliminado antes del
    // rechazo (cascada corrupta a medias, más el contacto sin poder
    // eliminarse porque la excepción se propaga). Cortamos ANTES de tocar
    // Firestore para no dejar nada a medias.
    const hasBlockingClassifiedFile = fileSnap.docs.some(
      (d) => (d.data() as { clasificado?: boolean }).clasificado === true
    );
    if (hasBlockingClassifiedFile && !this.permissionService.isAdmin()) {
      const err = new Error(
        'No se puede eliminar el contacto: tiene un documento clasificado adjunto. Solo un administrador de la empresa puede eliminarlo.'
      ) as Error & { code: string };
      err.code = 'contact-classified-file-blocks-delete';
      throw err;
    }

    // `writeBatch` en lugar de `Promise.all` de `updateDoc`s independientes:
    // todo-o-nada. Con Promise.all, si UNA escritura fallaba (p.ej. por
    // reglas), las demás ya podían haberse aplicado — cascada parcial.
    const batch = writeBatch(this.firestore);
    const softDeletePayload = stripUndefinedDeep({
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: uid,
    });
    for (const d of folderSnap.docs) {
      batch.update(doc(this.firestore, 'contact_folders', d.id), softDeletePayload);
    }
    for (const d of fileSnap.docs) {
      batch.update(doc(this.firestore, 'contact_files', d.id), softDeletePayload);
    }
    await batch.commit();
  }

  async addTag(contactId: string, tag: string): Promise<void> {
    await updateDoc(this.contactDoc(this.companyId, contactId), { tags: arrayUnion(tag) });
  }

  async removeTag(contactId: string, tag: string): Promise<void> {
    await updateDoc(this.contactDoc(this.companyId, contactId), { tags: arrayRemove(tag) });
  }
}
