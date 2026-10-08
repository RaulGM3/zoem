import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
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
  deleteField,
} from '@angular/fire/firestore';
import { stripUndefinedDeep } from '../firebase/sanitize';

export interface CompanyVerifactu {
  enabled: boolean;
  /** true → prewww1.aeat.es (sandbox AEAT), false → producción real */
  sandbox: boolean;
  /** NIF del certificado digital almacenado en Secret Manager */
  certNif?: string;
  certTitular?: string;
  certExpiry?: string; // ISO date
  certStoredAt?: string;
}

export type LogoContentType = 'image/png' | 'image/jpeg';

export interface CompanyLogo {
  /** Ruta en Storage: companies/{cid}/branding/logo */
  path: string;
  url: string;
  contentType: LogoContentType;
  /** ISO; versiona la caché del logo en el PDF. */
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  /**
   * Persona física (autónomo) → el identificador fiscal es un NIF.
   * Persona jurídica (sociedad) → el identificador fiscal es un CIF.
   * En ambos casos el valor se almacena en `cif`. El label cambia en la UI.
   */
  tipoPersona?: 'fisica' | 'juridica';
  /** Identificador fiscal de la empresa. Para persona jurídica es el CIF,
   *  para persona física es el NIF. Siempre se almacena en este campo. */
  cif?: string;
  plan?: string;
  isActive: boolean;
  email?: string;
  telefono?: string;
  direccion?: string;
  codigoPostal?: string;
  ciudad?: string;
  website?: string;
  /** Saldo bancario real cargado manualmente, para cotejar con el sistema. */
  saldoBancario?: number;
  /** Fecha (ISO yyyy-mm-dd) en que se actualizó el saldo bancario. */
  saldoBancarioFecha?: string;
  verifactu?: CompanyVerifactu;
  logo?: CompanyLogo;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Identificador fiscal de la empresa (CIF o NIF según tipo). Siempre en `cif`. */
export function getIdentificacionFiscal(company: Company): string | undefined {
  return company.cif;
}

/** Label para mostrar en la UI: "CIF" para juridica, "NIF" para física. */
export function getLabelIdentificacion(company: Company): string {
  return company.tipoPersona === 'fisica' ? 'NIF' : 'CIF';
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  role: string;
  company?: Company;
}

/** localStorage: empresa en la que el superusuario entró sin ser miembro. */
export const CLAVE_EMPRESA_SUPERUSER = 'zoem.superuser.empresa';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly firestore = inject(Firestore);
  private readonly document = inject(DOCUMENT);

  readonly myMemberships = signal<CompanyMember[]>([]);
  readonly activeCompany = signal<Company | null>(null);
  readonly allCompanies = signal<Company[]>([]);

  /** El superusuario está dentro de una empresa de la que no es miembro. */
  readonly modoSuperuser = computed(() => {
    const id = this.activeCompany()?.id;
    return !!id && !this.myMemberships().some((m) => m.companyId === id);
  });

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

  /**
   * El superusuario opera la empresa como si fuera suya: las rules ya lo dejan
   * pasar (isSuper). Se persiste la elección y se recarga la app entera para que
   * ningún servicio singleton conserve datos ni listeners de la empresa anterior;
   * restaurarEmpresaSuperuser la activa tras el login.
   */
  entrarComoSuperuser(companyId: string): void {
    this.guardarEmpresaSuperuser(companyId);
    this.document.location.assign('/');
  }

  /** Vuelve a la empresa propia (primera membresía) desde el panel de superusuario. */
  salirModoSuperuser(): void {
    this.guardarEmpresaSuperuser(null);
    this.document.location.assign('/superuser/companies');
  }

  /** Tras el login: reactiva la empresa en la que el superusuario había entrado. */
  async restaurarEmpresaSuperuser(): Promise<void> {
    const id = this.leerEmpresaSuperuser();
    if (!id) return;
    const company = await this.getCompany(id);
    if (company) this.activeCompany.set(company);
    else this.guardarEmpresaSuperuser(null);
  }

  private leerEmpresaSuperuser(): string | null {
    try {
      return localStorage.getItem(CLAVE_EMPRESA_SUPERUSER);
    } catch {
      return null;
    }
  }

  private guardarEmpresaSuperuser(id: string | null): void {
    try {
      if (id) localStorage.setItem(CLAVE_EMPRESA_SUPERUSER, id);
      else localStorage.removeItem(CLAVE_EMPRESA_SUPERUSER);
    } catch {
      // Sin storage la elección dura solo hasta la próxima recarga.
    }
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

  /** Elimina el campo `logo` (deleteField; updateCompany descartaría undefined) y refresca la company activa. */
  async removeCompanyLogo(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'companies', id), { logo: deleteField(), updatedAt: serverTimestamp() });
    this.activeCompany.update((c) => {
      if (!c || c.id !== id) return c;
      const { logo: _logo, ...rest } = c;
      return rest;
    });
  }
}
