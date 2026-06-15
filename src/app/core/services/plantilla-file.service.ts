import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { PlantillaFile } from '../../interfaces';

@Injectable({ providedIn: 'root' })
export class PlantillaFileService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);

  readonly files = signal<PlantillaFile[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  async loadFiles(plantillaId: string): Promise<void> {
    this.isLoading.set(true);
    this.files.set([]);
    try {
      const q = query(
        collection(this.firestore, 'plantilla_files'),
        where('companyId', '==', this.companyId),
        where('plantillaId', '==', plantillaId)
      );
      const snapshot = await getDocs(q);
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as PlantillaFile)
        .sort((a, b) => a.name.localeCompare(b.name));
      this.files.set(items);
    } catch {
      // No active company or Firestore error
    } finally {
      this.isLoading.set(false);
    }
  }

  async addFile(plantillaId: string, folderId: string | null, name: string): Promise<void> {
    await addDoc(collection(this.firestore, 'plantilla_files'), {
      plantillaId,
      companyId: this.companyId,
      folderId,
      name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await this.loadFiles(plantillaId);
  }

  async linkTemplate(fileId: string, docTemplateId: string | null): Promise<void> {
    await updateDoc(doc(this.firestore, 'plantilla_files', fileId), {
      docTemplateId,
      updatedAt: serverTimestamp(),
    });
    this.files.update((list) =>
      list.map((f) => (f.id === fileId ? { ...f, docTemplateId } : f))
    );
  }

  async deleteFile(fileId: string, plantillaId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'plantilla_files', fileId));
    this.files.update((list) => list.filter((f) => f.id !== fileId));
    void plantillaId;
  }
}
