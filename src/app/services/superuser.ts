import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { from, Observable } from 'rxjs';
import { stripUndefinedDeep } from '../core/firebase/sanitize';
import { Company } from '../interfaces/company';

@Injectable({
  providedIn: 'root',
})
export class SuperuserService {
  private firestore = inject(Firestore);
  private companiesCol = collection(this.firestore, 'companies');

  getCompanies(): Observable<Company[]> {
    return collectionData(this.companiesCol, { idField: 'id' }) as Observable<Company[]>;
  }

  createCompany(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Observable<void> {
    return from(
      addDoc(this.companiesCol, stripUndefinedDeep({
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })).then(() => undefined)
    );
  }

  updateCompany(id: string, data: Partial<Omit<Company, 'id' | 'createdAt'>>): Observable<void> {
    const ref = doc(this.firestore, 'companies', id);
    return from(updateDoc(ref, stripUndefinedDeep({ ...data, updatedAt: serverTimestamp() })));
  }

  deleteCompany(id: string): Observable<void> {
    const ref = doc(this.firestore, 'companies', id);
    return from(deleteDoc(ref));
  }
}
