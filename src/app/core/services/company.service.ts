import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from '@angular/fire/firestore';
import { stripUndefinedDeep } from '../firebase/sanitize';

export interface CompanyVerifactu {
  enabled: boolean;
  /** NIF del certificado digital almacenado en Secret Manager */
  certNif?: string;
  certTitular?: string;
  certExpiry?: string; // ISO date
  certStoredAt?: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  /** NIF fiscal de la empresa (requerido para Verifactu) */
  nif?: string;
  plan?: string;
  isActive: boolean;
  /** Saldo bancario real cargado manualmente, para cotejar con el sistema. */
  saldoBancario?: number;
  /** Fecha (ISO yyyy-mm-dd) en que se actualizó el saldo bancario. */
  saldoBancarioFecha?: string;
  verifactu?: CompanyVerifactu;
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
    // Membresía vive en companies/{cid}/members/{uid} → collectionGroup para todas las empresas del user.
    const q = query(collectionGroup(this.firestore, 'members'), where('userId', '==', userId));
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
    const ref = await addDoc(collection(this.firestore, 'companies'), stripUndefinedDeep({
      name,
      slug,
      plan: plan ?? null,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    return ref.id;
  }

  async updateCompany(id: string, data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'companies', id), stripUndefinedDeep({ ...data, updatedAt: serverTimestamp() }));
    this.activeCompany.update((c) => (c && c.id === id ? { ...c, ...data } : c));
  }

  /** Guarda el saldo bancario manual y refresca la company activa en memoria. */
  async updateSaldoBancario(id: string, saldoBancario: number, fecha: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'companies', id), stripUndefinedDeep({
      saldoBancario,
      saldoBancarioFecha: fecha,
      updatedAt: serverTimestamp(),
    }));
    this.activeCompany.update(c =>
      c && c.id === id ? { ...c, saldoBancario, saldoBancarioFecha: fecha } : c
    );
  }
}
