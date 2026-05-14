import { computed, Injectable, signal } from '@angular/core';
import { inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '@angular/fire/firestore';

export interface ZoemUser {
  id: string;
  email: string;
  displayName: string | null;
  isSuperUser: boolean;
  companyId?: string;
  role?: 'user' | 'admin';
  createdAt?: unknown;
  updatedAt?: unknown;
}

@Injectable({ providedIn: 'root' })
export class UserSyncService {
  private readonly firestore = inject(Firestore);

  readonly currentUser = signal<ZoemUser | null>(null);
  readonly isSuperUser = computed(() => this.currentUser()?.isSuperUser ?? false);

  async syncUser(email: string, displayName: string | null): Promise<void> {
    const userRef = doc(this.firestore, 'users', email);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      await setDoc(userRef, {
        email,
        displayName,
        isSuperUser: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, { displayName, updatedAt: serverTimestamp() }, { merge: true });
    }
    await this.loadCurrentUser(email);
  }

  async loadCurrentUser(email: string): Promise<void> {
    const userRef = doc(this.firestore, 'users', email);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      this.currentUser.set({ id: snapshot.id, ...snapshot.data() } as ZoemUser);
    } else {
      this.currentUser.set(null);
    }
  }

  async updateUserCompany(email: string, companyId: string, role: 'user' | 'admin'): Promise<void> {
    const userRef = doc(this.firestore, 'users', email);
    await updateDoc(userRef, { companyId, role, updatedAt: serverTimestamp() });
    this.currentUser.update((u) => u ? { ...u, companyId, role } : u);
  }
}
