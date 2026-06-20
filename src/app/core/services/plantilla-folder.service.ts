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
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { PlantillaFolder } from '../../interfaces';

@Injectable({ providedIn: 'root' })
export class PlantillaFolderService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);

  readonly folders = signal<PlantillaFolder[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  async loadFolders(plantillaId: string): Promise<void> {
    this.isLoading.set(true);
    this.folders.set([]);
    try {
      const q = query(
        collection(this.firestore, 'plantilla_folders'),
        where('companyId', '==', this.companyId),
        where('plantillaId', '==', plantillaId)
      );
      const snapshot = await getDocs(q);
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as PlantillaFolder)
        .sort((a, b) => a.name.localeCompare(b.name));
      this.folders.set(items);
    } finally {
      // El error se propaga al llamador (lo muestra ToastService).
      this.isLoading.set(false);
    }
  }

  async createFolder(data: {
    plantillaId: string;
    parentId: string | null;
    name: string;
  }): Promise<void> {
    await addDoc(collection(this.firestore, 'plantilla_folders'), stripUndefinedDeep({
      ...data,
      companyId: this.companyId,
      createdBy: this.auth.currentUser?.uid ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await this.loadFolders(data.plantillaId);
  }

  async updateFolder(id: string, data: Partial<Pick<PlantillaFolder, 'name'>>, plantillaId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'plantilla_folders', id), stripUndefinedDeep({
      ...data,
      updatedAt: serverTimestamp(),
    }));
    await this.loadFolders(plantillaId);
  }

  async deleteFolder(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'plantilla_folders', id));
    this.folders.update((list) => list.filter((f) => f.id !== id));
  }
}
