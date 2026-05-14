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
} from '@angular/fire/firestore';

export interface Company {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  role: string;
  company?: Company;
}

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly firestore = inject(Firestore);

  readonly myMemberships = signal<CompanyMember[]>([]);
  readonly activeCompany = signal<Company | null>(null);
  readonly allCompanies = signal<Company[]>([]);

  async loadMyCompanies(userId: string): Promise<void> {
    const membersRef = collection(this.firestore, 'companyMembers');
    const q = query(membersRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const memberships: CompanyMember[] = [];
    for (const memberDoc of snapshot.docs) {
      const data = memberDoc.data();
      const companySnap = await getDoc(doc(this.firestore, 'companies', data['companyId']));
      const company = companySnap.exists()
        ? ({ id: companySnap.id, ...companySnap.data() } as Company)
        : undefined;
      memberships.push({ id: memberDoc.id, ...data, company } as CompanyMember);
    }
    this.myMemberships.set(memberships);
    if (memberships.length > 0 && !this.activeCompany()) {
      this.activeCompany.set(memberships[0].company ?? null);
    }
  }

  setActiveCompany(company: Company): void {
    this.activeCompany.set(company);
  }

  async loadAllCompanies(): Promise<void> {
    const snapshot = await getDocs(collection(this.firestore, 'companies'));
    this.allCompanies.set(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Company));
  }

  async getCompany(id: string): Promise<Company | null> {
    const snapshot = await getDoc(doc(this.firestore, 'companies', id));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Company) : null;
  }

  async createCompany(name: string, slug: string, plan?: string): Promise<string> {
    const ref = await addDoc(collection(this.firestore, 'companies'), {
      name,
      slug,
      plan: plan ?? null,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  async updateCompany(id: string, data: { name?: string; plan?: string; isActive?: boolean }): Promise<void> {
    await updateDoc(doc(this.firestore, 'companies', id), { ...data, updatedAt: serverTimestamp() });
  }
}
