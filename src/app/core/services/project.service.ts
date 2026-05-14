import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';

export interface Project {
  id: string;
  companyId: string;
  title: string;
  clientName: string;
  projectType: string;
  status: string;
  priority: string;
  openDate: string;
  description?: string;
  nextDeadline?: string;
  assignedToId?: string;
  budget?: number;
  hoursLogged?: number;
  progress?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);

  readonly projects = signal<Project[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  async loadProjects(): Promise<void> {
    this.isLoading.set(true);
    try {
      const q = query(
        collection(this.firestore, 'projects'),
        where('companyId', '==', this.companyId)
      );
      const snapshot = await getDocs(q);
      this.projects.set(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Project));
    } finally {
      this.isLoading.set(false);
    }
  }

  async getProject(id: string): Promise<Project | null> {
    const snapshot = await getDoc(doc(this.firestore, 'projects', id));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Project) : null;
  }

  async createProject(data: Omit<Project, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await addDoc(collection(this.firestore, 'projects'), {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await this.loadProjects();
  }

  async updateProject(id: string, data: Partial<Omit<Project, 'id' | 'companyId'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'projects', id), { ...data, updatedAt: serverTimestamp() });
    await this.loadProjects();
  }

  async deleteProject(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'projects', id));
    this.projects.update((list) => list.filter((p) => p.id !== id));
  }
}
