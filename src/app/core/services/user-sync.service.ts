import { computed, Injectable, signal } from '@angular/core';
import { inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { SystemRole, VerteyUser, VerteyUserDespacho, VerteyUserProfesional } from '../../interfaces/user';

@Injectable({ providedIn: 'root' })
export class UserSyncService {
  private readonly firestore = inject(Firestore);

  readonly currentUser = signal<VerteyUser | null>(null);
  readonly isSuperUser = computed(() => this.currentUser()?.isSuperUser ?? false);

  async syncUser(uid: string, email: string, displayName: string | null): Promise<void> {
    const userRef = doc(this.firestore, 'users', uid);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      await setDoc(userRef, stripUndefinedDeep({
        email,
        displayName,
        isSuperUser: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    } else {
      await setDoc(userRef, stripUndefinedDeep({ displayName, updatedAt: serverTimestamp() }), { merge: true });
    }
    await this.loadCurrentUser(uid);
  }

  async loadCurrentUser(uid: string): Promise<void> {
    const userRef = doc(this.firestore, 'users', uid);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      this.currentUser.set({ id: snapshot.id, ...snapshot.data() } as VerteyUser);
    } else {
      this.currentUser.set(null);
    }
  }

  async updateUserProfile(
    uid: string,
    personal: { displayName: string; telefono: string; linkedin: string; biografia: string },
    despacho: VerteyUserDespacho,
    profesional: VerteyUserProfesional,
  ): Promise<void> {
    const userRef = doc(this.firestore, 'users', uid);
    const data = {
      displayName: personal.displayName,
      telefono: personal.telefono,
      linkedin: personal.linkedin,
      biografia: personal.biografia,
      despacho,
      profesional,
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, stripUndefinedDeep(data), { merge: true });
    this.currentUser.update((u) => u ? { ...u, ...data } : u);
  }

  async updateUserCompany(uid: string, companyId: string, role: SystemRole): Promise<void> {
    const userRef = doc(this.firestore, 'users', uid);
    await updateDoc(userRef, stripUndefinedDeep({ companyId, role, updatedAt: serverTimestamp() }));
    this.currentUser.update((u) => u ? { ...u, companyId, role } : u);
  }
}
